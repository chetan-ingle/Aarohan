import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    next();
  } catch { res.status(401).json({ message: 'Invalid or expired token' }); }
};

export const authorize = (...roles) => (req, res, next) => roles.includes(req.user.role)
  ? next() : res.status(403).json({ message: 'Insufficient permission' });

export const eventAccess = async (req, res, next) => {
  if (req.user.role === 'SUPER_ADMIN') return next();
  const eventId = req.params.eventId || req.body.eventId || req.body.event;
  if (eventId && req.user.assignedEvents.some((id) => id.toString() === eventId.toString())) return next();
  return res.status(403).json({ message: 'You are not assigned to this event' });
};
