import mongoose from 'mongoose';

const sponsorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  imageUrl: { type: String, required: true },
  imageFileId: String,
  active: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('Sponsor', sponsorSchema);
