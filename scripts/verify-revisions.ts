import assert from "node:assert/strict";
import { Client } from "pg";
async function main() {
const url = process.env.DATABASE_URL ?? "";
const parsed = new URL(url);
if (!["localhost","127.0.0.1"].includes(parsed.hostname) || parsed.pathname !== "/loyd_verify") throw new Error("This verification only runs against local loyd_verify.");
const db = new Client({connectionString:url});
await db.connect();
try {
  await db.query("BEGIN");
  await db.query("SELECT set_config('archive.actor_id','verification-actor',true), set_config('archive.actor_label','Verification editor',true), set_config('archive.reason','Verify atomic history',true)");
  const slug = `verify-${Date.now()}`;
  await db.query('INSERT INTO property_articles (slug,content) VALUES ($1,$2)',[slug,JSON.stringify({name:"Before"})]);
  await db.query('UPDATE property_articles SET content=$2,version=version+1 WHERE slug=$1 AND version=1',[slug,JSON.stringify({name:"After"})]);
  const stale = await db.query('UPDATE property_articles SET content=$2,version=version+1 WHERE slug=$1 AND version=1',[slug,JSON.stringify({name:"Stale"})]);
  assert.equal(stale.rowCount,0);
  const revisions = (await db.query('SELECT * FROM record_revisions WHERE "entityType"=\'property\' AND "entityId"=$1 ORDER BY operation',[slug])).rows;
  assert.equal(revisions.length,2);
  const update = revisions.find(r => r.operation === "UPDATE");
  assert.equal(update.before.content.name,"Before"); assert.equal(update.after.content.name,"After");
  assert.equal(update.actorUserId,"verification-actor"); assert.equal(update.actorLabel,"Verification editor");
  await db.query("SAVEPOINT immutable");
  await assert.rejects(db.query('DELETE FROM record_revisions WHERE id=$1',[update.id]),/append-only/);
  await db.query("ROLLBACK TO SAVEPOINT immutable");
  const user = (await db.query('SELECT id FROM users LIMIT 1')).rows[0];
  assert.ok(user);
  await db.query('UPDATE users SET name=$2,"passwordHash"=$3 WHERE id=$1',[user.id,"Audit verification","secret-must-not-appear"]);
  const userRevision = (await db.query('SELECT before,after FROM record_revisions WHERE "entityType"=\'user\' AND "entityId"=$1 ORDER BY sequence DESC LIMIT 1',[user.id])).rows[0];
  assert.ok(!JSON.stringify(userRevision).includes("secret-must-not-appear"));
  assert.ok(!Object.hasOwn(userRevision.after,"passwordHash")); assert.ok(!Object.hasOwn(userRevision.after,"email"));
  await db.query('UPDATE users SET "passwordHash"=$2 WHERE id=$1',[user.id,"second-secret-must-not-appear"]);
  const protectedRevision = (await db.query('SELECT before,after FROM record_revisions WHERE "entityType"=\'user\' AND "entityId"=$1 ORDER BY sequence DESC LIMIT 1',[user.id])).rows[0];
  assert.deepEqual(protectedRevision.after.protectedFieldsChanged,["passwordHash"]);
  assert.ok(!JSON.stringify(protectedRevision).includes("second-secret-must-not-appear"));
  await db.query("ROLLBACK");
  assert.equal((await db.query('SELECT count(*)::int AS count FROM record_revisions WHERE "entityId"=$1',[slug])).rows[0].count,0);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM property_articles WHERE slug=$1',[slug])).rows[0].count,0);
  console.log(JSON.stringify({atomicSnapshots:true,actor:true,staleWriteRejected:true,immutableHistory:true,credentialsExcluded:true,rollbackRemovesBoth:true}));
} finally { await db.query("ROLLBACK").catch(()=>{}); await db.end(); }

}
main().catch(error => { console.error(error); process.exitCode = 1; });
