import jwt from 'jsonwebtoken';

export const verifyAuth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (_error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const isDriver = (req, res, next) => {
  if (req.user?.role !== 'driver') {
    return res.status(403).json({ error: 'Driver access required' });
  }
  next();
};

export const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export const isBuyer = (req, res, next) => {
  if (req.user?.role !== 'buyer') {
    return res.status(403).json({ error: 'Buyer access required' });
  }
  next();
};

export const isSeller = (req, res, next) => {
  if (req.user?.role !== 'seller') {
    return res.status(403).json({ error: 'Seller access required' });
  }
  next();
};
