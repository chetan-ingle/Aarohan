# Aarohan Fest Platform

A MERN-stack college-fest management platform covering admin event setup, registrations, finance approval, QR check-in, scoring, and a public leaderboard.

## Quick start

1. Copy `server/.env.example` to `server/.env` and supply `MONGODB_URI`, `JWT_SECRET`, and SMTP values if email delivery is required.
2. Run `npm install` from the repository root.
3. Start both apps with `npm run dev`.

Create the first super-admin with `npm run seed:admin --workspace server`. Change the sample admin password through `ADMIN_PASSWORD` before using it outside development.

The web app runs at `http://localhost:5173` and the API at `http://localhost:5000`.

## Roles

`SUPER_ADMIN`, `FINANCE`, `CCT`, `GATE`, and `JUDGE` are protected by JWT middleware. Event-specific access is granted through each user's `assignedEvents` list (admins retain global access).

## Workflow

`PENDING → APPROVED → ACTIVE PASS → CHECKED_IN → VERIFIED → FINALIZED`

Rejected payments return to the participant for correction. QR tokens are signed JWTs, and a second successful scan is rejected.

## API map

| Purpose | Route |
| --- | --- |
| Public events / registration | `GET /api/events`, `POST /api/registrations` |
| Admin event management | `POST/PATCH /api/events` |
| Finance approval | `PATCH /api/registrations/:id/payment` |
| Gate validation | `POST /api/registrations/:id/check-in` |
| Scoring and results | `PATCH /api/registrations/:id/score`, `POST /api/registrations/:id/finalize` |
| Public results | `GET /api/registrations/leaderboard/:eventId` |

Payment screenshot upload: `POST /api/uploads/payment-proof` as `multipart/form-data` with the `proof` field. UPI QR upload: `POST /api/uploads/upi-qr`. Both use ImageKit when its environment values are set.
