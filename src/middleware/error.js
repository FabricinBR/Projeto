export function notFound(_req, res, _next) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err, _req, res, _next) {
  console.error(err);

  const message = err?.message || 'Internal Server Error';

  let status = 500;
  if (typeof err?.status === 'number') {
    status = err.status;
  } else if (/not found/i.test(message)) {
    status = 404;
  } else if (/insufficient stock/i.test(message)) {
    status = 409;
  }

  res.status(status).json({ error: message });
}
