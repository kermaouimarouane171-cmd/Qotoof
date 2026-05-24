import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';

export const verifyAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return next(new AppError('Authentication token is required.', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (_error) {
    return next(new AppError('Invalid or expired token.', 401));
  }
};

const requireRole = (role) => (req, res, next) => {
  if (req.user?.role !== role) {
    return next(new AppError(`${role} access required.`, 403));
  }
  return next();
};

export const isDriver = requireRole('driver');
export const isAdmin = requireRole('admin');
export const isBuyer = requireRole('buyer');
export const isSeller = requireRole('seller');
