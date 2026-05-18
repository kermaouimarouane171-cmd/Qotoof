import { AppError } from '../utils/AppError.js';

export const notFoundMiddleware = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};
