import AuditLog from '../models/AuditLog.js';
export const audit = (req, action, entityType, entityId, detail = {}) => AuditLog.create({
  actor: req.user?._id, action, entityType, entityId, detail, ip: req.ip
});
