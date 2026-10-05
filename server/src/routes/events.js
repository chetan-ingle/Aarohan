import express from 'express';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';
import User from '../models/User.js';
import PaymentMethod from '../models/PaymentMethod.js';
import { protect, authorize } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
const router = express.Router();

const assignPaymentMethod = (payload, paymentMethod) => {
  payload.paymentMethod = paymentMethod._id;
  // Store a snapshot on the event so participants can always see the correct
  // payment details even if the payment-account list changes later.
  payload.upiId = paymentMethod.upiId;
  payload.upiQrUrl = paymentMethod.qrUrl;
};

const applyPaymentMethod = async (payload, useDefault = false) => {
  if (!Object.prototype.hasOwnProperty.call(payload, 'paymentMethodId')) {
    if (!useDefault) return payload;
    const defaultMethod = await PaymentMethod.findOne({ active: true }).sort({ isDefault: -1, createdAt: -1 });
    if (defaultMethod) assignPaymentMethod(payload, defaultMethod);
    return payload;
  }
  const paymentMethodId = payload.paymentMethodId;
  delete payload.paymentMethodId;
  if (!paymentMethodId) return payload;

  const paymentMethod = await PaymentMethod.findOne({ _id: paymentMethodId, active: true });
  if (!paymentMethod) {
    const error = new Error('Choose an active saved payment QR.');
    error.status = 400;
    throw error;
  }
  assignPaymentMethod(payload, paymentMethod);
  return payload;
};

router.get('/', asyncHandler(async (_req, res) => {
  // Include closed events so they remain visible to Manage, CCT, public event
  // listings, and existing registrations. registrationOpen controls sign-ups.
  res.set('Cache-Control', 'no-store');
  const [events, primaryPaymentMethod] = await Promise.all([
    Event.find().sort('name').lean(),
    PaymentMethod.findOne({ isDefault: true, active: true }).lean(),
  ]);
  // Older events may not yet have a copied QR URL. Use the selected payment
  // account for the public response so the registration page can render it;
  // event-specific QR details are never overwritten here.
  res.json(events.map((event) => {
    if (event.upiQrUrl || !primaryPaymentMethod) return event;
    return {
      ...event,
      paymentMethod: event.paymentMethod || primaryPaymentMethod._id,
      upiId: event.upiId || primaryPaymentMethod.upiId,
      upiQrUrl: primaryPaymentMethod.qrUrl,
    };
  }));
}));
router.post('/', protect, authorize('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (payload.startsAt) payload.startsAt = new Date(payload.startsAt);
  await applyPaymentMethod(payload, true);
  const event = await Event.create(payload);
  await User.updateMany({ role: { $ne: 'SUPER_ADMIN' } }, { $addToSet: { assignedEvents: event._id } });
  res.status(201).json(event);
}));
router.patch('/:id', protect, authorize('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (payload.startsAt !== undefined) payload.startsAt = payload.startsAt ? new Date(payload.startsAt) : null;
  await applyPaymentMethod(payload);
  const event = await Event.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  res.json(event);
}));
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
