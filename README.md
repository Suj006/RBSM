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
   (online applicants get a temporary login Tradex2027-SNNN at once)
   ─► District recommends (one or many at once) / returns to the applicant for correction / rejects
        └─ applicant corrects and resubmits with the temporary login ─► back with the district
   ─► Directorate approves / returns to district / rejects
   ─► approved: seller number RBSM-Seller-2026NNN, visible to FIEO; the applicant's login becomes the
      permanent seller login (district-entered sellers get their login e-mailed now)
```

Until approval, a seller login shows only **My application**: progress, the district's comments, and (while
with the district or returned to the applicant) the form to correct and resubmit the details. After approval
it opens the full seller dashboard. A district can also return a district-entered seller to the applicant;
a login is then created and e-mailed.

Seller details at registration: name, district (14 Kerala districts), taluk (drop-down by district), local body type
(Panchayat / Municipality / Corporation) and name (municipalities and corporations from a drop-down; grama panchayat typed in),
Udyam number (Kerala only, UDYAM-KL-00-0000000, unique — users type only the digits), export experience — when Yes,
**countries exported to** (several, from the world list) and **products exported** (for reference only; not used in
matchmaking) — **IEC number**
(10 characters; required when the seller has export experience), **quality / product certifications** (from the certification
master, plus others), sectors with products ready to export, and promoter details (name of the promoter, mobile, WhatsApp, e-mail).
The Kerala masters (taluks, block panchayats, municipalities, corporations) are in `src/lib/kerala.ts`.

**Seller profile (after approval).** An approved seller completes **My profile**: gender and date of birth of the promoter,
social category (General / OBC / SC / ST), specially abled, block, constitution of the unit (Proprietary … Others), category
(Micro / Small / Medium / Large) and unit type (Manufacturing / Service / Trade); IEC and certifications can be updated there.
The dashboard asks for it until done, and buyer preferences can be sent only after it. Staff see "Profile pending" on
lists and dashboards, can filter by profile, category, unit type, promoter (women, SC / ST, specially abled), IEC and
certifications, and download the **Seller Profile Analysis** report (including the countries sellers already export to). Personal promoter details (gender, date of birth, social
category, specially abled) are shown to the Directorate, Admin and district centres only — not to FIEO or buyers.
Matchmaking adds 5 fit points for each certification the buyer requires that the seller holds (max 10), and flags pairs where the
seller holds none of the required certifications; buyers see their matched sellers' certifications, category and IEC status.
FIEO sees sellers only after Directorate approval. Seller products use the same sector master as buyer
requirements, ready for buyer–seller matchmaking. Targets (approved sellers overall and per district,
approved buyers, sellers per buyer — default 600 / 60 / 10) are set by the Directorate on the **Targets** page.

## Matchmaking (core module)

```
1. Directorate opens the buyer directory  ─► approved sellers see approved buyers (sectors, products,
                                              specifications, certifications, volumes)
2. Sellers give up to 5 tentative preferences, in order — final once submitted
3. Directorate freezes preferences          (only Admin can reopen; the Directorate can freeze again)
4. Directorate builds the mapping           ─► suggestions: up to 10 sellers per buyer, sharing the buyer's
                                              sectors — seller preferences first, then best fit
                                              (products, export experience); add / remove by hand
5. Checks flag incorrect mappings           (Directorate only, for reference — never blocks publishing)
6. Publish                                  ─► buyers, sellers, FIEO and district centres see it; changes
                                              stay in the working list until republished
7. Lock the final version                   (only Admin can unlock)
```

Every pair is labelled **Seller preference (#rank)**, **System match** or **Manual**. The Directorate sees each
seller's preferences and how many made it into the working list and the published mapping, plus **Results &
gaps**: buyers below 10 sellers, approved sellers without a buyer, sector coverage, requested products not
covered by the matched sellers, and district position. Reports: mapping (published or working list), seller
preferences and outcome, results and gaps. Buyers see their matched sellers; sellers their buyer meetings;
district centres the meetings of their sellers. Participants whose list changes are e-mailed on publishing.
**Reports at every step** (Excel and PDF, offered inside each step on the Matchmaking overview and on Reports):

| Step | Report | What it holds |
|---|---|---|
| 1 | Buyer directory for sellers | Approved buyers' approved sectors: products, specifications, certifications, volumes; approved sellers per sector; preferences received |
| 2–3 | Seller preferences and outcome | Each seller's ranked choices; every preference with the seller's sectors & products, the buyer's sectors & products, the fit and the result (in working list / published / why not placed); sellers yet to respond; preferences per buyer |
| 4 | Working list | Every pair with the buyer's approved sectors & products, the seller's sectors & products and **why matched** (seller's preference rank, common sectors, matching products, required certifications held, export experience, with the fit points); buyer-wise and seller-wise summaries; changes against the published version; pairs removed by the Directorate |
| 5 | Checks | Mappings to review, by severity |
| 5–6 | Published / final mapping, Results & gaps | As the working list, for the published (or locked) version; buyers below target and sellers without buyers with their sectors & products, sector and product coverage, district position |

FIEO and district centres get the published mapping (districts: their own sellers) with the sector, product and certification
reasons but without seller preference ranks or fit points. Buyers and sellers see "Matched on: <sectors>" for each meeting.

The Directorate and Admin work the module from one **Matchmaking** menu entry with tabs: Overview, Mapping
board, Seller preferences, Checks, Results & gaps, Published.

## Insights (Directorate / Admin)

A decision page built from live data, with an Excel / PDF report of every section:

- **Key findings and recommended actions** — plain-language points ranked by urgency (targets at risk,
  biggest drop-off, overdue files, lagging districts, sellers short in sectors, products with no supplier,
  high rework, matchmaking gaps), each with the next step and a link to the list behind it
- **Registration funnels** — buyers (sign-up → basic details → FIEO approval → sector submitted → approved)
  and sellers (registered → recommended → approved), with conversion from each previous stage
- **Progress to targets and pace** — approvals per week over the last 14 days and weeks to target
- **District performance** — districts ranked by approved sellers against target, files waiting over a
  week, average days to recommend, rejections
- **Seller profile** — women, SC / ST and specially abled promoters, unit category, type and constitution, IEC and
  certifications, district-wise, with profiles still pending; **certification readiness** — each certification approved
  buyers require against approved sellers holding it in those sectors
- Matchmaking readiness per approved buyer, sector supply gaps, district × sector supply, markets × sectors
  demand, certifications, **rework and rejection** rates, turnaround and ageing, and the matchmaking position

## Logins (phase-1 defaults — change before going live)

| Role | User name | Password | Can do |
|---|---|---|---|
| FIEO | `fieo` | `pass@123` | See all buyers, approve / return basic details, recommend / return each sector |
| Directorate | `dic123` | `dic123` | Central team: sees the whole programme — every buyer, sector and seller at every stage, all documents and all reports. Approves FIEO-recommended sectors (first approval adds the buyer to the RBSM list) / returns to FIEO; approves district-recommended sellers; sets targets |
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
- Every dashboard tile, pipeline legend and chart bar opens the matching list, with the same count
  (buyer tiles open **Buyer applications**; sector tiles open **Sector requirements**, one row per buyer sector)
- Easy navigation: "Back to …" on every inner page returns to the list you came from with its filters kept;
  after a decision, **Next pending application** opens the next item in your queue; sector rows jump straight
  to that sector on the buyer's page; on phones a shortcut jumps to the decision panel
- **RBSM buyer list** and **RBSM seller list** (Directorate, FIEO, Admin): every approved buyer / seller on screen,
  with one-click **Complete details** downloads (Excel and PDF) — buyers with contacts, sourcing profile and every
  approved sector (products, specifications, certifications, volumes); sellers with Udyam, location, promoter
  contact, export experience and every sector with products
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
