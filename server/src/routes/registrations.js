import express from 'express';
import crypto from 'node:crypto';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';
import { sendPassEmail, sendRegistrationEmail, sendReviewReminder } from '../utils/email.js';
import { sendCsv } from '../utils/csv.js';
import { createCategoryWorkbook } from '../utils/xlsx.js';
import { deleteImageKitFile } from '../utils/imagekit.js';
import asyncHandler from '../middleware/asyncHandler.js';
const router = express.Router();

// All staff have access to every event; role checks still protect each workflow area.
const scoped = () => ({});
const canAccess = () => true;

router.post('/', asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.body.event, active: true });
  if (!event) return res.status(404).json({ message: 'Event unavailable' });
  if (event.registrationDeadline && event.registrationDeadline < new Date()) return res.status(409).json({ message: 'Registration deadline has passed' });
  const approvedCount = await Registration.countDocuments({ event: event._id, 'payment.status': 'APPROVED' });
  if (approvedCount >= event.capacity) return res.status(409).json({ message: 'Event capacity reached' });
  const members = [];
  for (const field of (event.formFields || [])) if (/[a-z0-9]/i.test(field.label || '') && field.required && !req.body.responses?.[field.key]) return res.status(400).json({ message: `${field.label} is required` });
  const registration = await Registration.create({ ...req.body, teamName: '', members, payment: { ...req.body.payment, amount: event.fee } });
  await sendRegistrationEmail(registration, event);
  const reviewers = await User.find({ role: { $in: ['FINANCE', 'CCT'] } }).select('email');
  await sendReviewReminder(registration, event, reviewers.map((user) => user.email));
  res.status(201).json({ registrationId: registration.registrationId, status: registration.status, message: 'Registration submitted for payment verification.' });
}));

router.get('/', protect, authorize('SUPER_ADMIN', 'FINANCE', 'CCT', 'JUDGE'), asyncHandler(async (req, res) => {
  const filter = { ...scoped(req) }; if (req.query.eventId) filter.event = req.query.eventId; if (req.query.status) filter.status = req.query.status; if (req.query.paymentStatus) filter['payment.status'] = req.query.paymentStatus;
  res.json(await Registration.find(filter).populate('event', 'name fee format capacity').sort('-createdAt'));
}));

router.get('/export/finance', protect, authorize('FINANCE', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const rows = await Registration.find({ ...scoped(req) }).populate('event', 'name');
  sendCsv(res, 'finance-audit.csv', [{ label: 'Registration ID', value: (x) => x.registrationId }, { label: 'Event', value: (x) => x.event?.name }, { label: 'Participant', value: (x) => x.leader.name }, { label: 'Amount', value: (x) => x.payment.amount }, { label: 'UTR', value: (x) => x.payment.utr }, { label: 'Status', value: (x) => x.payment.status }, { label: 'Reviewed At', value: (x) => x.payment.reviewedAt?.toISOString() }], rows);
}));

router.get('/export/category/:category', protect, authorize('SUPER_ADMIN', 'CCT', 'JUDGE'), asyncHandler(async (req, res) => {
  const category = String(req.params.category || '').toUpperCase();
  if (!['SPORT', 'MANAGEMENT', 'CULTURAL'].includes(category)) return res.status(400).json({ message: 'Invalid event category' });
  const events = await Event.find({ category }).select('_id');
  const rows = await Registration.find({ event: { $in: events.map((event) => event._id) } }).populate('event', 'name category');
  sendCsv(res, `${category.toLowerCase()}-category-roster.csv`, [{ label: 'Category', value: (x) => x.event?.category }, { label: 'Event', value: (x) => x.event?.name }, { label: 'Registration ID', value: (x) => x.registrationId }, { label: 'Participant', value: (x) => x.leader.name }, { label: 'Email', value: (x) => x.leader.email }, { label: 'Phone', value: (x) => x.leader.phone }, { label: 'Team', value: (x) => x.teamName }, { label: 'Members', value: (x) => x.members.map((m) => m.name).join('; ') }, { label: 'Received amount', value: (x) => x.payment.amount }, { label: 'Payment status', value: (x) => x.payment.status }, { label: 'Registration status', value: (x) => x.status }], rows);
}));

router.get('/export/categories-workbook', protect, authorize('SUPER_ADMIN', 'CCT'), asyncHandler(async (req, res) => {
  const categories = [['SPORT', 'Sports'], ['MANAGEMENT', 'Management'], ['CULTURAL', 'Cultural']];
  const rows = await Registration.find({ ...scoped(req) }).populate('event', 'name category').sort('event.name registrationId');
  const headers = ['Registration ID', 'Participant / Team', 'Participant email', 'Contact', 'Event', 'Team members', 'Received amount', 'Payment status', 'QR pass status', 'Check-in status'];
  const workbook = createCategoryWorkbook(categories.map(([category, name]) => ({ name, rows: [headers, ...rows.filter((item) => item.event?.category === category).map((item) => [item.registrationId, item.teamName || item.leader.name, item.leader.email, item.leader.phone, item.event?.name, item.members.map((member) => `${member.name}${member.phone ? ` (${member.phone})` : ''}`).join('; '), item.payment.amount, item.payment.status, item.passActive ? 'ACTIVE' : 'NOT ISSUED', item.status === 'CHECKED_IN' ? 'CHECKED IN' : 'NOT CHECKED IN'])] })));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="abstract-aarohan-category-rosters.xlsx"');
  res.send(workbook);
}));

router.get('/export/event/:eventId', protect, authorize('SUPER_ADMIN', 'CCT', 'JUDGE'), asyncHandler(async (req, res) => {
  const rows = await Registration.find({ event: req.params.eventId });
  sendCsv(res, 'event-roster.csv', [{ label: 'Registration ID', value: (x) => x.registrationId }, { label: 'Participant', value: (x) => x.leader.name }, { label: 'Email', value: (x) => x.leader.email }, { label: 'Phone', value: (x) => x.leader.phone }, { label: 'Team', value: (x) => x.teamName }, { label: 'Members', value: (x) => x.members.map((m) => m.name).join('; ') }, { label: 'Received amount', value: (x) => x.payment.amount }, { label: 'Payment status', value: (x) => x.payment.status }, { label: 'Status', value: (x) => x.status }, { label: 'Score', value: (x) => x.score }, { label: 'Rank', value: (x) => x.rank }], rows);
}));

router.delete('/:id', protect, authorize('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const registration = await Registration.findByIdAndDelete(req.params.id);
  if (!registration) return res.status(404).json({ message: 'Participant registration not found' });
  res.json({ message: 'Participant registration deleted' });
}));

router.patch('/:id/payment', protect, authorize('FINANCE', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const status = req.body.status;
  if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ message: 'Invalid payment status' });
  const registration = await Registration.findById(req.params.id).populate('event');
  if (!registration) return res.status(404).json({ message: 'Registration not found' });
  if (!canAccess(req.user, registration)) return res.status(403).json({ message: 'Event not assigned' });
  if (status === 'APPROVED') { const count = await Registration.countDocuments({ event: registration.event._id, 'payment.status': 'APPROVED', _id: { $ne: registration._id } }); if (count >= registration.event.capacity) return res.status(409).json({ message: 'Event capacity reached' }); }
  registration.payment.status = status; registration.payment.reviewedBy = req.user._id; registration.payment.reviewedAt = new Date(); registration.payment.note = req.body.note || '';
  registration.status = status === 'APPROVED' ? 'APPROVED' : 'PENDING';
  if (status === 'APPROVED' && !registration.passToken) { registration.passToken = crypto.randomBytes(32).toString('hex'); registration.passActive = true; registration.passIssuedAt = new Date(); }
  if (status === 'APPROVED' && registration.payment.screenshotFileId) {
    try {
      await deleteImageKitFile(registration.payment.screenshotFileId);
      registration.payment.screenshotUrl = undefined;
      registration.payment.screenshotFileId = undefined;
    } catch (error) { console.error(`Could not delete payment proof for ${registration.registrationId}:`, error.message); }
  }
  await registration.save(); await audit(req, `PAYMENT_${status}`, 'Registration', registration._id, { note: req.body.note });
  if (status === 'APPROVED') await sendPassEmail(registration, registration.event);
  res.json(registration);
}));

router.post('/:id/resend-pass', protect, authorize('FINANCE', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const registration = await Registration.findById(req.params.id).populate('event');
  if (!registration || !registration.passActive) return res.status(404).json({ message: 'An approved QR pass was not found' });
  if (!canAccess(req.user, registration)) return res.status(403).json({ message: 'Event not assigned' });
  const delivery = await sendPassEmail(registration, registration.event);
  if (!delivery.sent) return res.status(502).json({ message: `Email was not sent: ${delivery.error}` });
  await audit(req, 'PASS_REMAILED', 'Registration', registration._id);
  res.json({ message: 'QR pass email sent' });
}));

router.get('/:id/pass', protect, asyncHandler(async (req, res) => {
  const registration = await Registration.findById(req.params.id).populate('event');
  if (!registration || !registration.passActive) return res.status(404).json({ message: 'Active pass not found' });
  res.json({ registrationId: registration.registrationId, token: registration.passToken, event: registration.event.name, participant: registration.teamName || registration.leader.name, venue: registration.event.venue, startsAt: registration.event.startsAt });
}));

router.post('/pass-lookup', asyncHandler(async (req, res) => {
  const registration = await Registration.findOne({ registrationId: String(req.body.registrationId || '').toUpperCase(), 'leader.email': String(req.body.email || '').toLowerCase(), passActive: true }).populate('event');
  if (!registration) return res.status(404).json({ message: 'No active pass found. Check your ID/email or wait for finance approval.' });
  res.json({ registrationId: registration.registrationId, token: registration.passToken, event: registration.event.name, participant: registration.teamName || registration.leader.name, venue: registration.event.venue, startsAt: registration.event.startsAt });
}));

router.post('/scan', protect, authorize('GATE', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const raw = String(req.body.token || ''); const token = raw.includes(':') ? raw.split(':').at(-1) : raw;
  const registration = await Registration.findOne({ passToken: token, passActive: true }).populate('event');
  if (!registration) return res.status(400).json({ message: 'Invalid QR pass' });
  if (!canAccess(req.user, registration)) return res.status(403).json({ message: 'Event not assigned' });
  if (registration.checkedInAt) return res.status(409).json({ message: `Already checked in at ${registration.checkedInAt.toLocaleString()}` });
  registration.checkedInAt = new Date(); registration.checkedInBy = req.user._id; registration.status = 'CHECKED_IN'; await registration.save(); await audit(req, 'CHECK_IN', 'Registration', registration._id);
  res.json({ message: 'Check-in successful', registrationId: registration.registrationId, participant: registration.teamName || registration.leader.name, event: registration.event.name });
}));

router.patch('/:id/score', protect, authorize('JUDGE', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const registration = await Registration.findById(req.params.id); if (!registration) return res.status(404).json({ message: 'Registration not found' });
  if (!canAccess(req.user, registration)) return res.status(403).json({ message: 'Event not assigned' });
  if (registration.status !== 'CHECKED_IN') return res.status(409).json({ message: 'Only checked-in participants can be scored' });
  registration.score = Number(req.body.score || 0); registration.penalty = Number(req.body.penalty || 0); registration.judgeNote = req.body.judgeNote || ''; registration.status = req.body.disqualified ? 'DISQUALIFIED' : 'VERIFIED'; await registration.save(); await audit(req, req.body.disqualified ? 'DISQUALIFIED' : 'SCORE_VERIFIED', 'Registration', registration._id); res.json(registration);
}));

router.post('/:id/finalize', protect, authorize('JUDGE', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const registration = await Registration.findById(req.params.id); if (!registration) return res.status(404).json({ message: 'Registration not found' });
  if (!canAccess(req.user, registration)) return res.status(403).json({ message: 'Event not assigned' });
  if (registration.status !== 'VERIFIED') return res.status(409).json({ message: 'Only verified scores can be finalized' });
  const conflict = await Registration.findOne({ event: registration.event, rank: req.body.rank, status: 'FINALIZED', _id: { $ne: registration._id } }); if (conflict) return res.status(409).json({ message: 'This rank has already been assigned' });
  registration.status = 'FINALIZED'; registration.rank = Number(req.body.rank); await registration.save(); await audit(req, 'RESULT_FINALIZED', 'Registration', registration._id, { rank: registration.rank }); res.json(registration);
}));

router.get('/leaderboard/:eventId', asyncHandler(async (req, res) => res.json(await Registration.find({ event: req.params.eventId, status: 'FINALIZED' }).sort('rank -score').select('registrationId leader teamName score penalty rank'))));
export default router;
