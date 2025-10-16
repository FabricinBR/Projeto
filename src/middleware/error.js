export function notFound(_req, res, _next) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err, _req, res, _next) {
  console.error(err);
  const status = /not found|insufficient stock/i.test(err.message) ? 400 : 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
}
