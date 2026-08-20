import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import dns from 'node:dns';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import registrationRoutes from './routes/registrations.js';
import uploadRoutes from './routes/uploads.js';
import sponsorRoutes from './routes/sponsors.js';

const app = express();

// In local development, let nodemon restart after unexpected fatal errors.
// Vercel manages function lifecycles itself, so the function must not call process.exit().
if (!process.env.VERCEL) {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    setTimeout(() => process.exit(1), 100);
  });
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    setTimeout(() => process.exit(1), 100);
  });
}

if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(',').map((server) => server.trim()));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true }));
app.use(express.json({ limit: '1mb' })); app.use(morgan('dev')); app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
app.use('/uploads', express.static('uploads'));
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes); app.use('/api/events', eventRoutes); app.use('/api/registrations', registrationRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/sponsors', sponsorRoutes);
app.use((err, _req, res, _next) => {
  console.error(err);
  // Mongoose validation errors -> 400 with validation messages
  if (err && err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e) => e.message).filter(Boolean);
    return res.status(400).json({ message: messages.length ? messages.join('; ') : 'Validation failed' });
  }
  // Duplicate key errors
  if (err && err.code === 11000) return res.status(409).json({ message: 'Duplicate record' });
  // If handler set a status, use it
  if (err && err.status && Number.isInteger(err.status)) return res.status(err.status).json({ message: err.message || 'Error' });
  return res.status(500).json({ message: 'Server error' });
});
const connectDatabase = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  return mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || 'aarohan', serverSelectionTimeoutMS: 15000 });
};

if (process.env.VERCEL) {
  await connectDatabase();
} else {
  const port = Number(process.env.PORT) || 5000;
  connectDatabase().then(() => {
    const server = app.listen(port, () => console.log('API ready'));
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Another process may be running. Exiting.`);
        process.exit(1);
      }
      console.error('Server error:', err);
      process.exit(1);
    });
  }).catch((err) => { console.error('MongoDB connection failed:', err.message); process.exit(1); });
}

export default app;
