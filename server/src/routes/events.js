import express from 'express';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
const router = express.Router();

router.get('/', asyncHandler(async (_req, res) => res.json(await Event.find({ active: true }).sort('name'))));
router.post('/', protect, authorize('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const event = await Event.create(req.body);
  await User.updateMany({ role: { $ne: 'SUPER_ADMIN' } }, { $addToSet: { assignedEvents: event._id } });
  res.status(201).json(event);
}));
router.patch('/:id', protect, authorize('SUPER_ADMIN'), asyncHandler(async (req, res) => res.json(await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }))));
router.delete('/:id', protect, authorize('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const registrations = await Registration.countDocuments({ event: req.params.id });
  if (registrations) return res.status(409).json({ message: 'Delete this event’s participant registrations before deleting the event.' });
  const event = await Event.findByIdAndDelete(req.params.id);
  if (!event) return res.status(404).json({ message: 'Event not found' });
  await User.updateMany({}, { $pull: { assignedEvents: event._id } });
  res.json({ message: 'Event deleted' });
}));
router.get('/:id/roster', protect, authorize('SUPER_ADMIN', 'CCT'), asyncHandler(async (req, res) => res.json(await Registration.find({ event: req.params.id }).sort('-createdAt'))));
export default router;
