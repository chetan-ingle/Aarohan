import express from 'express';
import Sponsor from '../models/Sponsor.js';
import { protect, authorize } from '../middleware/auth.js';
import { deleteImageKitFile } from '../utils/imagekit.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = express.Router();

router.get('/', asyncHandler(async (_req, res) => res.json(await Sponsor.find({ active: true }).sort('createdAt'))));
router.post('/', protect, authorize('SUPER_ADMIN'), asyncHandler(async (req, res) => res.status(201).json(await Sponsor.create(req.body))));
router.delete('/:id', protect, authorize('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const sponsor = await Sponsor.findByIdAndDelete(req.params.id);
  if (!sponsor) return res.status(404).json({ message: 'Sponsor not found' });
  if (sponsor.imageFileId) {
    try { await deleteImageKitFile(sponsor.imageFileId); } catch (error) { console.error(`Could not delete sponsor image ${sponsor._id}:`, error.message); }
  }
  res.json({ message: 'Sponsor deleted' });
}));

export default router;
