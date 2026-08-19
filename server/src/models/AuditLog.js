import mongoose from 'mongoose';
const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, action: { type: String, required: true },
  entityType: { type: String, required: true }, entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  detail: mongoose.Schema.Types.Mixed, ip: String
}, { timestamps: true });
export default mongoose.model('AuditLog', auditLogSchema);
