import { Router } from 'express';
import { pool } from '../db.js';
import { productsInCollectionSQL } from '../utils/sql.js';

const router = Router();

// GET /api/collections
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, name, slug, type FROM collections ORDER BY id');
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/collections/:slug/products
router.get('/:slug/products', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const [rows] = await pool.query(productsInCollectionSQL, [slug]);
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
