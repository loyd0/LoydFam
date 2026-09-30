# Loyd Family History

Private family archive built with Next.js, PostgreSQL/Prisma and authenticated file storage.

Preview: https://loyd-family-preview.vercel.app

The preview retains Vercel protection and the existing family login. The production website at `loyd.family` has not been redeployed by this update.

## Features

- People, relationships, biographies, notes, tags, timelines and CSV/JSON/GEDCOM exports.
- Phone navigation, accessible searchable person dialogs, and name/original-number searches with dates and record identifiers for disambiguation.
- Account Settings → **This is me** saves the starting person for family exploration. Explicit person links override that preference. Depth controls start at **Full**; reduce the view only when desired.
- Photo-rich 3D family tree with orbit, pan, zoom, search, focus, full-tree controls and an accessible 2D fallback.
- Historical family map using city/country evidence from the records. Multiple countries are retained; undated residence text is excluded from date-filtered views. Coordinates are place centers, not private addresses or proof of current residence.
- Relationship paths and closest shared recorded ancestors, with biological/step/adoptive/unknown links distinguished.
- Statistics with coverage, sample-size and incomplete-record caveats, cohort/name/branch comparisons.
- Admin workbook preview, complete import history, repeat-file protection and private original-workbook downloads.
- Private photo/PDF uploads, caption editing, primary portraits and authenticated viewing/downloads.

## Local setup

Use Node 24 and `npm ci`. Put configuration in `.env.local` (never commit it):

- `DATABASE_URL`: PostgreSQL connection string. Neon is supported; localhost uses the standard PostgreSQL adapter.
- `AUTH_SECRET`: Auth.js secret.
- `AUTH_URL`: local origin, for example `http://localhost:3000`.
- `BLOB_READ_WRITE_TOKEN`: token for a **private** Vercel Blob store.
- `CLOUDFLARE_EMAIL_ACCOUNT_ID`, `CLOUDFLARE_EMAIL_API_TOKEN` (Email Sending: Edit), and `EMAIL_FROM` (plain email address on an onboarded Cloudflare sending domain). `APP_URL` is the canonical origin used in invitation/reset links.
- `NEXT_PUBLIC_APP_URL`: legacy fallback for invitation/password-reset links; prefer server-only `APP_URL`.

See [Cloudflare email setup](docs/cloudflare-email.md) for provisioning status and domain cutover instructions.

`npm run dev` starts development. The server may choose another port if 3000 is occupied; set `AUTH_URL` accordingly.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm audit
```

`VERIFY_URL`, `VERIFY_EMAIL`, and `VERIFY_PASSWORD` can be supplied securely to `node scripts/verify-http.mjs` for read-only authenticated checks. `VERIFY_WORKBOOK` additionally checks import preview. Use isolated fixture accounts for admin/viewer permission checks.

## Data and imports

The supplied original is `POST 2022 LOYD BOOK BOOK DATABASE_6.xlsx` (24 sheets). It has been archived privately and verified against its SHA-256 hash. Original rows remain available in PostgreSQL. Existing family records are not regenerated during deployment.

```sh
npm run import:preview
npx tsx scripts/import.ts --file /path/to/workbook.xlsx --dry-run
npx tsx scripts/archive-source.ts             # read-only report
npx tsx scripts/archive-source.ts --execute   # archives exact original bytes
```

The admin UI requires preview before import. A completed SHA-256 is returned without reapplying the file, protecting subsequent edits. Changed workbooks can update matching canonical records: back up and review the preview before applying one. Failed imports preserve their run history and may be retried; imports use batches, not one transaction covering the whole workbook.

## Migrations, backups and recovery

The first migration baselines the previously deployed schema; the second adds missing invitation, password-reset and activity fields. Both were verified on a restored copy before the additive live migration.

- **New empty database:** `npx prisma migrate deploy`.
- **Existing database matching the original baseline:** first compare its schema, then `npx prisma migrate resolve --applied 20260929000000_baseline`, then `npx prisma migrate deploy`.
- Never mark a migration applied against an unverified database or run reset on family data.

`npm run db:backup` writes a private custom-format dump under ignored `.backups/`. Use PostgreSQL 17+ `pg_dump`; set `PG_DUMP_BINARY` if needed. Restore only into a separate empty database with `pg_restore --no-owner --no-acl -d <isolated-database> <dump>`, verify row counts and application flows, then plan any recovery cutover. A full backup/isolated restore was performed during this update.

Keep an encrypted off-device copy of database backups. Blob files require their own retention/copy policy; a database dump contains metadata, not uploaded file bytes.

## Hosting and storage decision

Retain Neon Postgres: the app depends on relational joins, PostgreSQL enums/arrays and trigram indexes. Moving to Cloudflare D1 would require SQLite adaptation. Cloudflare R2 remains a good future media option, especially if bandwidth or media volume grows. For this preview, repairing storage with a private London-region Blob store avoided a provider migration while delivering authenticated media and a verified original-source archive. File access is routed by media ID so storage URLs do not become the browser-facing contract.

The private store is connected to preview/development. Production file access must be configured before a production promotion. Cloudflare email integration is installed, but sending remains pending the Namecheap nameserver switch, sending-domain activation, and restricted API token setup. Admins can share invitation links manually.

## Deploying

`npx vercel@latest deploy --yes` creates a preview in the linked project. Use `--scope portcullis` for alias/inspection commands; the CLI's global scope can differ from the linked project. Point `loyd-family-preview.vercel.app` to the verified preview with `vercel alias set`.

Production promotion is a separate action. The private workbook, backups, local environment files and verification artifacts are excluded from deployment by `.vercelignore`.
