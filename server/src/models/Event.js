import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: String,
  rules: String,
  fee: { type: Number, required: true, min: 0 },
  // Capacity is intentionally not collected in the event form. This high default
  // keeps registration open unless an existing event was configured with a limit.
  capacity: { type: Number, default: 100000, min: 1 },
  format: { type: String, enum: ['SOLO', 'TEAM'], required: true },
  minTeamSize: { type: Number, default: 1 },
  maxTeamSize: { type: Number, default: 1 },
  category: { type: String, enum: ['SPORT', 'MANAGEMENT', 'CULTURAL'], required: true },
  venue: String,
  startsAt: Date,
  registrationDeadline: Date,
  coordinatorName: String,
  coordinatorPhone: String,
  upiId: String,
  paymentInstructions: String,
  upiQrUrl: String,
  formFields: [{ label: String, key: String, type: { type: String, enum: ['TEXT', 'EMAIL', 'PHONE', 'NUMBER'], default: 'TEXT' }, required: { type: Boolean, default: false } }],
  active: { type: Boolean, default: true }
}, { timestamps: true });
export default mongoose.model('Event', eventSchema);
