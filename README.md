# TRADEX 2.0 — Reverse Buyer Seller Meet (RBSM) Portal

End-to-end management portal for the TRADEX 2.0 Reverse Buyer Seller Meet: participant registration,
profiling, verification, matchmaking, meeting scheduling, communication, monitoring and reporting.

**Phase 1 (this release): international buyer registration and approval workflow.**

## Workflow

```
Buyer sign-up ─► e-mail with login (Tradex2027-NNN / pass@123) ─► forced password change
   ─► Basic details + documents ─► FIEO approves (or returns with comment)
   ─► Sourcing profile + one requirement per sector
        each sector separately:  submitted ─► FIEO recommends / returns to buyer
                                           ─► DIC approves / returns to FIEO
   ─► first approved sector makes the buyer an approved RBSM buyer (RBSM-Buyer-2026NNN)
   ─► approved buyers can add sectors or modify approved ones — same approval flow
```

FIEO and the Directorate decide each sector on its own (e.g. recommend one sector and return
another in the same step), with "Recommend all" / "Approve all" shortcuts.

| Number | Format | Assigned |
|---|---|---|
| Login ID | `Tradex2027-001` | at sign-up |
| Registration no. | `RBSM-B-001` | at sign-up |
| Buyer no. | `RBSM-Buyer-2026001` | when the first sector is approved by the Directorate |

## Sellers (Kerala MSMEs)

```
District office enters a seller (form or bulk Excel upload)  ─┐
Seller self-registers and chooses a district ─────────────────┴─► with that district office
   ─► District recommends (one or many at once) ─► Directorate approves / returns to district / rejects
   ─► approved: seller number RBSM-Seller-2026NNN, login Tradex2027-SNNN e-mailed, visible to FIEO
```

Seller details: name, district (14 Kerala districts), taluk, local body type (Panchayat / Municipality /
Corporation) and name, Udyam number (Kerala only, UDYAM-KL-00-0000000, unique — users type only the digits), export experience,
sectors with products ready to export, and promoter contact (name, mobile, WhatsApp, e-mail).
FIEO sees sellers only after Directorate approval. Seller products use the same sector master as buyer
requirements, ready for buyer–seller matchmaking. Targets (approved sellers overall and per district,
approved buyers, sellers per buyer — default 600 / 60 / 10) are set by the Directorate on the **Targets** page.

## Logins (phase-1 defaults — change before going live)

| Role | User name | Password | Can do |
|---|---|---|---|
| FIEO | `fieo` | `pass@123` | See all buyers, approve / return basic details, recommend / return each sector |
| Directorate | `dic123` | `dic123` | See FIEO-recommended sectors, approve each (first approval adds the buyer to the RBSM list) / return to FIEO |
| Admin | `admin` | `admin` | Sector & certification masters, users, buyer password reset, e-mail outbox, all reports |
| District offices (14) | `dic-tvm`, `dic-klm`, `dic-pta`, `dic-alp`, `dic-ktm`, `dic-idk`, `dic-ekm`, `dic-tsr`, `dic-pkd`, `dic-mlp`, `dic-kkd`, `dic-wyd`, `dic-knr`, `dic-ksd` | `pass@123` | Register sellers of their district (form / bulk Excel upload, up to 5 sectors per row), recommend or reject |
| Buyer | `Tradex2027-NNN` | `pass@123` (must change on first login) | Own profile and requirement |
| Seller | `Tradex2027-SNNN` (allotted on approval) | `pass@123` (must change on first login) | Own seller dashboard |

Staff passwords can be changed from **Admin → Users & logins**.

## Features

- Sign-up with full world country list, e-mail format check and duplicate check
- English-only input everywhere; names and designations saved in Title Case (e.g. "sujith hdhd" → "Sujith Hdhd"); contact names accept letters and spaces only
- Credential e-mails (SMTP) plus an **E-mail outbox** that records every message
- Document uploads (PDF/JPG/PNG, 5 MB, content-checked) served only to authorised users
- Detailed requirement: multiple sectors, products, specifications, volumes, certifications (master + custom)
- Sector-wise approval: save draft / submit per sector, return-with-comment at FIEO and Directorate, modify approved sectors or add new ones later; full audit trail
- Role dashboards: KPIs, pipeline, sign-up trend, top countries, sectors of interest, work queue
- Reports (Reports page for FIEO, Directorate and Admin) — each as a formatted **Excel** workbook and a **PDF**
  with the TRADEX letterhead, coloured headings, status colours, summary boxes and page numbers:
  Buyer Registration Register, Sector-wise Requirement Report, RBSM Approved Buyer List, MIS Summary,
  and a Buyer Profile for any single buyer (from the buyer's page). Filters on the list/report pages apply.
- **Sector demand** page and report (FIEO, Directorate, Admin): per sector, the buyers, each product requested
  with the buyers asking for it, required certifications, and the approved sellers offering it (matching
  products highlighted)
- Change tracking: when a buyer modifies an approved sector (or resubmits a returned one), reviewers see each
  change highlighted against the approved / returned version

## Running locally

```bash
cp .env.example .env
npm install              # also generates the Prisma client
npx prisma migrate deploy
npm run db:seed          # staff logins, sectors, certifications
npm run dev              # http://localhost:3000
```

To try the dashboards and reports with sample data, run `npm run db:demo` on an empty database
(loads 40 demo buyers and about 150 demo sellers at every stage; demo password `pass@123`).

After updating from an older version, run `npx prisma migrate deploy` (database changes) and
`npm run db:seed` (adds new logins such as the district offices; existing data is kept). Once, run
`npm run db:normalize` to re-format names already saved.

Production: `npm run build && npm start`. Set `APP_URL` and the `SMTP_*` variables in `.env` so buyers
receive their credentials by e-mail; without SMTP the e-mails appear only in **Admin → E-mail outbox**
and the sign-up screen shows the credentials. Uploaded files are stored in `storage/uploads`
(override with `UPLOAD_DIR`) — include it in backups together with `dev.db`.

## Branding

Colours come from the TRADEX logo (`src/app/globals.css`, `@theme`). The logo file is set in
`src/lib/config.ts` (`EVENT.logo`); replace `public/tradex-logo.svg` or point it to the official artwork.

## Stack

Next.js 16 (App Router, server actions) · React 19 · Prisma 7 + SQLite · Tailwind CSS 4 · Zod · Nodemailer
