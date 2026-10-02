import mongoose from 'mongoose';

const paymentMethodSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  upiId: { type: String, required: true, trim: true },
  qrUrl: { type: String, required: true },
  qrFileId: String,
  active: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('PaymentMethod', paymentMethodSchema);
