import { AppError } from './AppError.js';

export const handleError = (error, res) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof AppError ? error.message : 'Something went wrong.';

  console.error('[api-error]', {
    message: error.message,
    statusCode,
    stack: error.stack,
  });

  res.status(statusCode).json({
    status: 'error',
    message,
  });
};
