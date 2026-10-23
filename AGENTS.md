<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cloud Agent local development

The saved environment installs Node 24 under `/usr/local/bin`. A login shell can resolve an older Node first (`/exec-daemon/node` or nvm). Prepend `/usr/local/bin` before `npm`, `npx`, or `tsx`.

`start` launches PostgreSQL 16 with `pg_ctlcluster`. Service starts are denied by `policy-rc.d` in this VM. It rewrites loopback `pg_hba.conf` lines to `trust` and writes gitignored `.env` with `DATABASE_URL=postgresql://postgres@127.0.0.1:5432/loyd`, which selects the `pg` adapter in `src/lib/prisma.ts`. That script refuses any other database URL.

`npx prisma migrate deploy` cannot apply `prisma/migrations/20260929000000_baseline/migration.sql` as committed: the trigram GIN indexes include `ASC`, and PostgreSQL rejects that. `start` executes those statements without `ASC`, then `prisma migrate resolve --applied`, so the committed checksum stays unchanged. Leave that migration file as it is; databases that already stored its checksum would reject an edit. If the baseline has not finished, `start` drops and recreates only the local `loyd` database before applying SQL.

`npx tsx scripts/seed-admin.ts` upserts the local admin. Photo upload needs `BLOB_READ_WRITE_TOKEN`. Invitation email needs the Cloudflare variables in `.env.example`. Sign-in and record editing work without them.

Do not run `prisma migrate reset` against family data.
