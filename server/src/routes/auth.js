import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Event from '../models/Event.js';
import { protect, authorize } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = express.Router();
const sign = (user) => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });

router.post('/login', asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+password');
  if (!user || !(await user.matchesPassword(req.body.password))) return res.status(401).json({ message: 'Invalid email or password' });
  res.json({ token: sign(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
}));

router.post('/users', protect, authorize('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const assignedEvents = req.body.role === 'SUPER_ADMIN' ? [] : await Event.find({ active: true }).distinct('_id');
  const user = await User.create({ ...req.body, assignedEvents });
  res.status(201).json(user);
}));

router.post('/users/assign-all-events', protect, authorize('SUPER_ADMIN'), asyncHandler(async (_req, res) => {
  const assignedEvents = await Event.find({ active: true }).distinct('_id');
  await User.updateMany({ role: { $ne: 'SUPER_ADMIN' } }, { $set: { assignedEvents } });
  res.json({ message: 'All active events assigned to all staff' });
}));

router.get('/users', protect, authorize('SUPER_ADMIN'), asyncHandler(async (_req, res) => {
  res.json(await User.find().populate('assignedEvents', 'name').sort('name'));
}));

router.patch('/users/:id', protect, authorize('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const allowed = Object.fromEntries(Object.entries((({ name, role, assignedEvents }) => ({ name, role, assignedEvents }))(req.body)).filter(([, value]) => value !== undefined));
  res.json(await User.findByIdAndUpdate(req.params.id, allowed, { new: true, runValidators: true }));
}));

router.delete('/users/:id', protect, authorize('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  if (String(req.user._id) === req.params.id) return res.status(400).json({ message: 'You cannot delete your own Super Admin account.' });
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: 'Staff account not found' });
  res.json({ message: 'Staff account deleted' });
}));

export default router;
