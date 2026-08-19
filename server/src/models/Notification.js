import mongoose from 'mongoose';
const notificationSchema = new mongoose.Schema({
  registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' }, to: String, type: String,
  subject: String, status: { type: String, enum: ['SENT', 'FAILED', 'PENDING'], default: 'PENDING' }, error: String
}, { timestamps: true });
export default mongoose.model('Notification', notificationSchema);
