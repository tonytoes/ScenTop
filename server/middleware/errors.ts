import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../lib/errors';

export const apiNotFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: { message: `No such endpoint: ${req.method} ${req.path}`, code: 'not_found' } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, code: err.code, fields: err.fields } });
    return;
  }

  // Invalid JSON bodies and oversized payloads are thrown by express.json()
  const status = typeof err?.status === 'number' && err.status < 500 ? err.status : 500;
  if (status < 500) {
    const message = status === 413 ? 'That request is too large.' : 'The request could not be read.';
    res.status(status).json({ error: { message, code: 'bad_request' } });
    return;
  }

  console.error('[error]', err);
  res.status(500).json({ error: { message: 'Something went wrong on our side. Please try again.', code: 'server_error' } });
};
