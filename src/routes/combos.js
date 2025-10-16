import { Router } from 'express';
import { pool } from '../db.js';
import { comboPriceSQL } from '../utils/sql.js';

const router = Router();

// GET /api/combos
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, name, slug, discount_type, discount_value, active FROM combos ORDER BY id');
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/combos/:slug/price
router.get('/:slug/price', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const [rows] = await pool.query(comboPriceSQL, [slug]);
    if (!rows.length) return res.status(404).json({ error: 'Combo not found or empty' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

export default router;
