import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

const router = Router();

const positiveIntFromInput = (field) =>
  z.coerce
    .number({ invalid_type_error: `${field} must be a number` })
    .int(`${field} must be an integer`)
    .positive(`${field} must be greater than zero`);

const currencyFromInput = (field) =>
  z.coerce
    .number({ invalid_type_error: `${field} must be a number` })
    .min(0, `${field} cannot be negative`)
    .transform((value) => Number(value.toFixed(2)));

const OrderItemSchema = z.object({
  variant_id: positiveIntFromInput('variant_id'),
  qty: positiveIntFromInput('qty'),
});

const CreateOrderSchema = z.object({
  user_id: z.union([positiveIntFromInput('user_id'), z.null()]).optional(),
  items: z.array(OrderItemSchema).min(1),
  shipping_total: currencyFromInput('shipping_total').default(25),
});

// POST /api/orders
// Body: { user_id?, items:[{variant_id, qty}], shipping_total? }
router.post('/', async (req, res, next) => {
  const parsed = CreateOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { user_id = null, items, shipping_total } = parsed.data;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // compute item prices & check stock
    const pricedItems = [];
    let subtotal = 0;

    for (const { variant_id, qty } of items) {
      const [rows] = await conn.query(
        `SELECT v.id AS variant_id, v.stock_qty,
                p.id AS product_id, p.name, p.sku,
                COALESCE(v.price_override, p.price) AS unit_price
         FROM product_variants v
         JOIN products p ON p.id=v.product_id
         WHERE v.id=? AND v.active=1`,
        [variant_id]
      );
      if (!rows.length) throw new Error(`Variant ${variant_id} not found/active`);
      const r = rows[0];
      if (r.stock_qty < qty) throw new Error(`Insufficient stock for variant ${variant_id}`);

      const total_price = Number((r.unit_price * qty).toFixed(2));
      subtotal += total_price;
      pricedItems.push({
        product_id: r.product_id,
        variant_id: r.variant_id,
        name: r.name,
        sku: r.sku,
        qty,
        unit_price: r.unit_price,
        total_price,
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    const discount_total = 0;
    const normalized_shipping_total = Number(shipping_total.toFixed(2));
    const grand_total = Number((subtotal - discount_total + normalized_shipping_total).toFixed(2));

    // create order
    const [orderResult] = await conn.query(
      `INSERT INTO orders (user_id, status, subtotal, discount_total, shipping_total, grand_total, payment_status)
       VALUES (?, 'NEW', ?, ?, ?, ?, 'PENDING')`,
      [user_id, subtotal, discount_total, normalized_shipping_total, grand_total]
    );
    const order_id = orderResult.insertId;

    // create order items & decrement stock
    for (const it of pricedItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, name, sku, qty, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [order_id, it.product_id, it.variant_id, it.name, it.sku, it.qty, it.unit_price, it.total_price]
      );
      await conn.query(
        `UPDATE product_variants SET stock_qty = stock_qty - ? WHERE id=?`,
        [it.qty, it.variant_id]
      );
    }

    await conn.commit();
    res
      .status(201)
      .json({
        order_id,
        subtotal,
        discount_total,
        shipping_total: normalized_shipping_total,
        grand_total,
        items: pricedItems,
      });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

export default router;
