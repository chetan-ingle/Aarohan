import express from 'express';
import upload from '../middleware/upload.js';
import imagekit from '../config/imagekit.js';

const router = express.Router();

const isImageKitConfigured = () => {
  return Boolean(process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT);
};

const uploadToImageKit = (file, folder) => new Promise((resolve, reject) => {
  if (!isImageKitConfigured()) {
    const err = new Error('ImageKit credentials not configured');
    err.status = 503;
    return reject(err);
  }

  const fileName = `${Date.now()}-${(file.originalname || 'upload').replace(/\s+/g, '_')}`;

  imagekit.upload({
    file: file.buffer,
    fileName,
    folder: `/${folder}`,
  }, (error, result) => {
    if (error) {
      const e = new Error(error.message || 'ImageKit upload error');
      // ImageKit errors may use statusCode
      e.status = error && (error.statusCode || error.http_status) ? (error.statusCode || error.http_status) : 502;
      e.details = error;
      return reject(e);
    }
    return resolve(result);
  });
});

router.post('/payment-proof', upload.single('proof'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ message: 'Upload a JPG, PNG, or WebP image up to 5 MB' });
  try {
    const result = await uploadToImageKit(req.file, 'aarohan/payment-proofs');
    res.status(201).json({ url: result.url, fileId: result.fileId });
  } catch (error) {
    if (error && error.status) return res.status(error.status).json({ message: error.message });
    next(error);
  }
});

router.post('/upi-qr', upload.single('qr'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ message: 'Upload a UPI QR image' });
  try {
    const result = await uploadToImageKit(req.file, 'aarohan/upi');
    res.status(201).json({ url: result.url, fileId: result.fileId });
  } catch (error) {
    if (error && error.status) return res.status(error.status).json({ message: error.message });
    next(error);
  }
});

export default router;
