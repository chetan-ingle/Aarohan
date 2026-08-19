import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import Notification from '../models/Notification.js';

const send = async (payload, message) => {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      await Notification.create({ ...payload, status: 'PENDING', error: 'Gmail App Password is not configured' });
      return { sent: false, error: 'Gmail App Password is not configured' };
    }
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
    await transporter.sendMail({ from: process.env.EMAIL_FROM || process.env.GMAIL_USER, to: payload.to, ...message });
    await Notification.create({ ...payload, status: 'SENT' });
    return { sent: true };
  } catch (error) {
    await Notification.create({ ...payload, status: 'FAILED', error: error.message });
    return { sent: false, error: error.message };
  }
};

export const sendRegistrationEmail = (registration, event) => send(
  { registration: registration._id, to: registration.leader.email, type: 'REGISTRATION_RECEIVED', subject: `${process.env.FESTIVAL_NAME || 'Aarohan'} registration received` },
  { subject: `${process.env.FESTIVAL_NAME || 'Aarohan'} registration received`, text: `Your registration for ${event.name} was received. Registration ID: ${registration.registrationId}. Payment verification is pending.`, html: `<h1>Registration received</h1><p>Thank you for registering for <strong>${event.name}</strong>.</p><p><strong>Registration ID:</strong> ${registration.registrationId}</p><p>Payment verification is pending. Your QR pass will be emailed after Finance approval.</p>` }
);

export const sendReviewReminder = async (registration, event, recipients) => {
  const uniqueRecipients = [...new Set(recipients.filter(Boolean))];
  const subject = `Action needed: verify ${registration.registrationId} for ${event.name}`;
  return Promise.all(uniqueRecipients.map((to) => send(
    { registration: registration._id, to, type: 'STAFF_PAYMENT_REVIEW', subject },
    { subject, text: `A participant has registered for ${event.name}. Registration ID: ${registration.registrationId}. Please check the payment proof, UTR, and amount in the Finance dashboard, then approve or reject the payment.`, html: `<h1>Payment review needed</h1><p>A participant has registered for <strong>${event.name}</strong>.</p><p><strong>Registration ID:</strong> ${registration.registrationId}</p><p>Please check the payment proof, UTR, and amount in the Finance dashboard, then approve or reject the payment.</p>` }
  )));
};

export const sendPassEmail = async (registration, event) => {
  const payload = { registration: registration._id, to: registration.leader.email, type: 'QR_PASS', subject: `${process.env.FESTIVAL_NAME || 'Aarohan'} QR Pass` };
  const qrImage = await QRCode.toBuffer(`AAROHAN:${registration.passToken}`, { type: 'png', width: 600, margin: 2, errorCorrectionLevel: 'M' });
  const passUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/#pass`;
  return send(payload, { subject: payload.subject, text: `Your ${event.name} QR pass is attached. Registration ID: ${registration.registrationId}. Open ${passUrl} to retrieve it.`, html: `<h1>Your Aarohan QR Pass</h1><p>Your registration for <strong>${event.name}</strong> has been approved.</p><p><strong>Registration ID:</strong> ${registration.registrationId}</p><img src="cid:aarohan-qr" width="280" height="280" alt="Aarohan QR pass" /><p>Present this QR at the gate.</p><p><a href="${passUrl}">Open your pass portal</a></p>`, attachments: [{ filename: `${registration.registrationId}-qr-pass.png`, content: qrImage, cid: 'aarohan-qr' }] });
};
