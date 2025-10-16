import { Router } from 'express';
import { pool } from '../db.js';
import { productSummarySQL, productBySlugSQL, productVariantsSQL } from '../utils/sql.js';

const router = Router();

// GET /api/products?search=legging
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.search || '').toString().trim();
    if (!q) {
      const [rows] = await pool.query(`${productSummarySQL} ORDER BY p.name LIMIT 100`);
      return res.json(rows);
    }
    // Parameterized LIKE search
    const like = `%${q}%`;
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.slug,
              (SELECT url FROM product_images i WHERE i.product_id=p.id ORDER BY sort_order LIMIT 1) AS image
       FROM products p
       WHERE p.active=1 AND (p.name LIKE ? OR p.slug LIKE ?)
       ORDER BY p.name LIMIT 100`,
      [like, like]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/products/:slug (details + categories + images + variants)
router.get('/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const [[product]] = await pool.query(productBySlugSQL, [slug]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const [variants] = await pool.query(productVariantsSQL, [slug]);
    const [images] = await pool.query(
      `SELECT url, alt FROM product_images i
       JOIN products p ON p.id=i.product_id
       WHERE p.slug=? ORDER BY sort_order`,
      [slug]
    );

    res.json({ product, variants, images });
  } catch (err) { next(err); }
});

export default router;
