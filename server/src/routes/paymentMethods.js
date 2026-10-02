import express from 'express';
import PaymentMethod from '../models/PaymentMethod.js';
import Event from '../models/Event.js';
import { protect, authorize } from '../middleware/auth.js';
import { deleteImageKitFile } from '../utils/imagekit.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = express.Router();

router.get('/', protect, authorize('SUPER_ADMIN', 'FINANCE'), asyncHandler(async (_req, res) => {
  res.json(await PaymentMethod.find().sort({ isDefault: -1, createdAt: -1 }));
}));

router.post('/', protect, authorize('SUPER_ADMIN', 'FINANCE'), asyncHandler(async (req, res) => {
  const { label, upiId, qrUrl, qrFileId } = req.body;
  if (!label?.trim() || !upiId?.trim() || !qrUrl) {
    return res.status(400).json({ message: 'Payment account name, UPI ID, and QR image are required.' });
  }
  const hasDefault = await PaymentMethod.exists({ isDefault: true });
  res.status(201).json(await PaymentMethod.create({ label, upiId, qrUrl, qrFileId, isDefault: !hasDefault }));
}));

router.patch('/:id/default', protect, authorize('SUPER_ADMIN', 'FINANCE'), asyncHandler(async (req, res) => {
  const paymentMethod = await PaymentMethod.findById(req.params.id);
  if (!paymentMethod) return res.status(404).json({ message: 'Payment QR not found.' });
  await PaymentMethod.updateMany({ _id: { $ne: paymentMethod._id } }, { $set: { isDefault: false } });
  paymentMethod.isDefault = true;
  await paymentMethod.save();
  // Finance selects the currently used receiving account. Update every event
  // so its public registration form immediately displays this QR and UPI ID.
  const update = {
    paymentMethod: paymentMethod._id,
    upiId: paymentMethod.upiId,
    upiQrUrl: paymentMethod.qrUrl,
  };
  const result = await Event.updateMany({}, { $set: update });
  res.json({ ...paymentMethod.toObject(), updatedEvents: result.modifiedCount });
}));

router.delete('/:id', protect, authorize('SUPER_ADMIN', 'FINANCE'), asyncHandler(async (req, res) => {
  const paymentMethod = await PaymentMethod.findById(req.params.id);
  if (!paymentMethod) return res.status(404).json({ message: 'Payment QR not found.' });

  const eventsUsingMethod = await Event.countDocuments({ paymentMethod: paymentMethod._id });
  if (eventsUsingMethod) {
    return res.status(409).json({
      message: `This payment QR is used by ${eventsUsingMethod} event(s). Assign another QR to those events before deleting it.`,
    });
  }

  await paymentMethod.deleteOne();
  if (paymentMethod.qrFileId) {
    try { await deleteImageKitFile(paymentMethod.qrFileId); } catch (error) { console.error(`Could not delete payment QR ${paymentMethod._id}:`, error.message); }
  }
  res.json({ message: 'Payment QR deleted.' });
}));

export default router;
