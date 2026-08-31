import mongoose from 'mongoose';

const emailVerificationSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  lastSentAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('EmailVerification', emailVerificationSchema);
