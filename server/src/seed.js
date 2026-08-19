import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'node:dns';
import User from './models/User.js';

const admins = [
  {
    name: process.env.ADMIN_1_NAME || 'Aarohan Admin 1',
    email: process.env.ADMIN_1_EMAIL || process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_1_PASSWORD || process.env.ADMIN_PASSWORD,
  },
  {
    name: process.env.ADMIN_2_NAME || 'Aarohan Admin 2',
    email: process.env.ADMIN_2_EMAIL,
    password: process.env.ADMIN_2_PASSWORD,
  },
].filter((admin) => admin.email && admin.password);

if (admins.length < 2) throw new Error('Configure ADMIN_1_EMAIL, ADMIN_1_PASSWORD, ADMIN_2_EMAIL, and ADMIN_2_PASSWORD to seed two Super Admin accounts.');
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(',').map((server) => server.trim()));
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || 'aarohan' });
for (const admin of admins) {
  const existing = await User.findOne({ email: admin.email });
  if (existing) console.log(`Admin already exists: ${admin.email}`);
  else { await User.create({ ...admin, role: 'SUPER_ADMIN' }); console.log(`Created admin: ${admin.email}`); }
}
await mongoose.disconnect();
