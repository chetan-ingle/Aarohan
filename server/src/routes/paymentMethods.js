import express from 'express';
import PaymentMethod from '../models/PaymentMethod.js';
import Event from '../models/Event.js';
import { protect, authorize } from '../middleware/auth.js';
import { deleteImageKitFile } from '../utils/imagekit.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = express.Router();

router.use(protect, authorize('SUPER_ADMIN'));

router.get('/', asyncHandler(async (_req, res) => {
  res.json(await PaymentMethod.find().sort('-createdAt'));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { label, upiId, qrUrl, qrFileId } = req.body;
  if (!label?.trim() || !upiId?.trim() || !qrUrl) {
    return res.status(400).json({ message: 'Payment account name, UPI ID, and QR image are required.' });
  }
  res.status(201).json(await PaymentMethod.create({ label, upiId, qrUrl, qrFileId }));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
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
