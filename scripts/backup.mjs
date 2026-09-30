import { config } from 'dotenv';
import { mkdirSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
config({ path: '.env.local', quiet: true });
config({ quiet: true });
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const url = new URL(process.env.DATABASE_URL.trim());
const output = resolve('.backups', `loyd-${new Date().toISOString().replaceAll(':', '-')}.dump`);
mkdirSync('.backups', { recursive: true, mode: 0o700 });
const result = spawnSync(process.env.PG_DUMP_BINARY || 'pg_dump', [
  '--format=custom', '--no-owner', '--no-acl', `--file=${output}`,
], { env: {
  ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: url.pathname.slice(1), PGSSLMODE: ['localhost','127.0.0.1'].includes(url.hostname) ? 'disable' : 'require',
}, encoding: 'utf8' });
if (result.status !== 0) {
  console.error('Backup failed. Check database connectivity and use a pg_dump version matching or newer than the server. Credentials are not printed.');
  process.exitCode = 1;
} else {
  chmodSync(output, 0o600);
  console.log(`Backup saved: ${output}`);
}
