import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import { PAYMENT_STATUS, REGISTRATION_STATUS } from '../config/constants.js';

const memberSchema = new mongoose.Schema({ name: String, email: String, phone: String }, { _id: false });
const registrationSchema = new mongoose.Schema({
  registrationId: { type: String, unique: true, default: () => `AAR-${nanoid(8).toUpperCase()}` },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  leader: { type: memberSchema, required: true }, college: String, department: String, year: String,
  responses: { type: Map, of: String, default: {} },
  teamName: String,
  members: [memberSchema],
  payment: {
    amount: { type: Number, required: true }, utr: { type: String, required: true, trim: true }, screenshotUrl: String, screenshotFileId: String,
    status: { type: String, enum: PAYMENT_STATUS, default: 'PENDING' }, reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, reviewedAt: Date, note: String
  },
  status: { type: String, enum: REGISTRATION_STATUS, default: 'PENDING' },
  passToken: { type: String, unique: true, sparse: true }, passActive: { type: Boolean, default: false }, passIssuedAt: Date,
  checkedInAt: Date, checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  score: { type: Number, default: 0 }, penalty: { type: Number, default: 0 }, rank: Number, judgeNote: String
}, { timestamps: true });
registrationSchema.index({ event: 1, 'payment.utr': 1 }, { unique: true });
export default mongoose.model('Registration', registrationSchema);
