import { AppError } from '../utils/AppError.js';

export const errorMiddleware = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err instanceof AppError || err.isOperational;

  const logPayload = {
    message: err.message,
    statusCode,
    method: req.method,
    path: req.originalUrl,
    stack: err.stack,
  };

  console.error('[api-error]', logPayload);

  if (!isOperational) {
    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong.',
    });
  }

  return res.status(statusCode).json({
    status: err.status || 'error',
    message: err.message || 'Request failed.',
  });
};
