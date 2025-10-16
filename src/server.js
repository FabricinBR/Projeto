import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler, notFound } from './middleware/error.js';

import productsRouter from './routes/products.js';
import collectionsRouter from './routes/collections.js';
import combosRouter from './routes/combos.js';
import ordersRouter from './routes/orders.js';

const app = express();
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use('/api/products', productsRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/combos', combosRouter);
app.use('/api/orders', ordersRouter);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MEF API listening on http://localhost:${PORT}`));
