# TRADEX 2.0 — Reverse Buyer Seller Meet (RBSM) Portal

End-to-end management portal for the TRADEX 2.0 Reverse Buyer Seller Meet: participant registration,
profiling, verification, matchmaking, meeting scheduling, communication, monitoring and reporting.

**Phase 1 (this release): international buyer registration and approval workflow.**

## Workflow

```
Buyer sign-up ─► e-mail with login (Tradex2027-NNN / pass@123) ─► forced password change
   ─► Basic details + documents ─► FIEO approves (or returns with comment)
   ─► Detailed requirement (sectors, products, certifications) ─► FIEO recommends (or returns to buyer)
   ─► Directorate approves (or returns to FIEO with comment) ─► RBSM buyer list (RBSM-Buyer-2026NNN)
```

| Number | Format | Assigned |
|---|---|---|
| Login ID | `Tradex2027-001` | at sign-up |
| Registration no. | `RBSM-B-001` | at sign-up |
| Buyer no. | `RBSM-Buyer-2026001` | on Directorate approval |

## Logins (phase-1 defaults — change before going live)

| Role | User name | Password | Can do |
|---|---|---|---|
| FIEO | `fieo` | `pass@123` | See all buyers, approve / return basic details, recommend / return requirements |
| Directorate | `dic123` | `dic123` | See recommended buyers, approve (adds to RBSM list) / return to FIEO |
| Admin | `admin` | `admin` | Sector & certification masters, users, buyer password reset, e-mail outbox, all reports |
| Buyer | `Tradex2027-NNN` | `pass@123` (must change on first login) | Own profile and requirement |

Staff passwords can be changed from **Admin → Users & logins**.

## Features

- Sign-up with full world country list, e-mail format check and duplicate check
- Credential e-mails (SMTP) plus an **E-mail outbox** that records every message
- Document uploads (PDF/JPG/PNG, 5 MB, content-checked) served only to authorised users
- Detailed requirement: multiple sectors, products, specifications, volumes, certifications (master + custom)
- Save draft / submit; return-with-comment loops at FIEO and Directorate stages; full audit trail
- Role dashboards: KPIs, pipeline, sign-up trend, top countries, sectors of interest, work queue
- Reports: buyer list and sector-wise requirement sheet (Excel-ready CSV, filter-aware), printable buyer dossier and RBSM buyer list (Print / Save PDF)

## Running locally

```bash
cp .env.example .env
npm install              # also generates the Prisma client
npx prisma migrate deploy
npm run db:seed          # staff logins, sectors, certifications
npm run dev              # http://localhost:3000
```

Production: `npm run build && npm start`. Set `APP_URL` and the `SMTP_*` variables in `.env` so buyers
receive their credentials by e-mail; without SMTP the e-mails appear only in **Admin → E-mail outbox**
and the sign-up screen shows the credentials. Uploaded files are stored in `storage/uploads`
(override with `UPLOAD_DIR`) — include it in backups together with `dev.db`.

## Branding

Colours come from the TRADEX logo (`src/app/globals.css`, `@theme`). The logo file is set in
`src/lib/config.ts` (`EVENT.logo`); replace `public/tradex-logo.svg` or point it to the official artwork.

## Stack

Next.js 16 (App Router, server actions) · React 19 · Prisma 7 + SQLite · Tailwind CSS 4 · Zod · Nodemailer
