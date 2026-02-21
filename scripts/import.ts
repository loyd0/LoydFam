/**
 * Direct import script — runs the import pipeline outside of the HTTP layer.
 * Usage: npx tsx scripts/import.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Need to set up the environment manually
import "dotenv/config";

async function main() {
  const filePath = resolve(
    process.cwd(),
    "POST 2022 LOYD BOOK BOOK DATABASE_6.xlsx"
  );
  console.log(`📂 Reading: ${filePath}`);
  const buffer = Buffer.from(readFileSync(filePath));
  console.log(`📦 File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

  // Dynamic import to ensure env is loaded first
  const { parseWorkbook } = await import("../src/lib/importer/parse-workbook");
  const { extractCanonical } = await import("../src/lib/importer/canonical-extract");
  const { prisma } = await import("../src/lib/prisma");
  const { hashRow } = await import("../src/lib/importer/parse-workbook");

  const MAX_OPS_PER_TXN = 50;
  const TXN_TIMEOUT = 30_000; // 30s timeout for Neon Postgres

  function chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  console.log("\n🔍 Parsing workbook...");
  const parsed = parseWorkbook(buffer);
  console.log(`   SHA256: ${parsed.sha256}`);
  console.log(`   Sheets: ${parsed.sheets.length}`);
  parsed.sheets.forEach((s) => {
    console.log(`   • ${s.sheetName}: ${s.rows.length} rows`);
  });

  console.log("\n🧬 Extracting canonical data...");
  const canonical = extractCanonical(parsed.sheets);
  console.log(`   People:        ${canonical.people.length}`);
  console.log(`   Events:        ${canonical.events.length}`);
  console.log(`   ParentChild:   ${canonical.parentChild.length}`);
  console.log(`   Partnerships:  ${canonical.partnerships.length}`);
  console.log(`   Contacts:      ${canonical.contacts.length}`);

  // Delete old import issues so we get a fresh set
  console.log("\n🧹 Cleaning up old import issues...");
  await prisma.importIssue.deleteMany({});

  // Store source file
  console.log("\n💾 Creating source file record...");
  const sourceFile = await prisma.sourceFile.upsert({
    where: { sha256: parsed.sha256 },
    create: { originalFilename: "POST 2022 LOYD BOOK BOOK DATABASE_6.xlsx", sha256: parsed.sha256 },
    update: { originalFilename: "POST 2022 LOYD BOOK BOOK DATABASE_6.xlsx" },
  });

  const importRun = await prisma.importRun.create({
    data: { sourceFileId: sourceFile.id, status: "RUNNING", startedAt: new Date(), appVersion: "1.0.0" },
  });

  // Store raw sheets + rows (batched)
  console.log("📝 Storing raw sheets...");
  let rawRowsStored = 0;
  for (const sheet of parsed.sheets) {
    const importSheet = await prisma.importSheet.create({
      data: { importRunId: importRun.id, sheetName: sheet.sheetName, rowCount: sheet.rows.length },
    });

    const rowChunks = chunk(sheet.rows, MAX_OPS_PER_TXN);
    for (let ci = 0; ci < rowChunks.length; ci++) {
      const batch = rowChunks[ci];
      const baseIdx = ci * MAX_OPS_PER_TXN;
      await prisma.importRow.createMany({
        data: batch.map((row, idx) => ({
          importSheetId: importSheet.id,
          rowIndex: baseIdx + idx,
          rowJson: row as object,
          rowHash: hashRow(row),
          isBlank: Object.values(row).every((v) => v == null || v === ""),
        })),
      });
      rawRowsStored += batch.length;
    }
    process.stdout.write(`   ✓ ${sheet.sheetName} (${sheet.rows.length} rows)\n`);
  }
  console.log(`   Total raw rows: ${rawRowsStored}`);

  // Upsert people (batched transactions)
  console.log("\n👤 Upserting people...");
  const personIdMap = new Map<string, string>();
  let count = 0;

  const peopleChunks = chunk(canonical.people, MAX_OPS_PER_TXN);
  for (const batch of peopleChunks) {
    const results = await prisma.$transaction(
      batch.map((p) =>
        prisma.person.upsert({
          where: { primaryExternalKey: p.primaryExternalKey },
          create: {
            primaryExternalKey: p.primaryExternalKey, sourceSystem: p.sourceSystem,
            externalId: p.externalId, surname: p.surname, givenName1: p.givenName1,
            givenName2: p.givenName2, givenName3: p.givenName3, knownAs: p.knownAs,
            preferredName: p.preferredName, displayName: p.displayName, gender: p.gender,
            isPlaceholder: p.isPlaceholder, biographyMd: p.biographyMd,
            biographyShortMd: p.biographyShortMd, residencyText: p.residencyText,
            dspFlag: p.dspFlag, expectedPhotoCount: p.expectedPhotoCount,
            legacyGeneration: p.legacyGeneration, generationFromWilliam: p.generationFromWilliam,
            descendantGeneration: p.descendantGeneration, lengthMetric: p.lengthMetric,
            rawNameString: p.rawNameString, branchRootExternalId: p.branchRootExternalId,
          },
          update: {
            displayName: p.displayName, gender: p.gender,
            surname: p.surname || undefined, givenName1: p.givenName1 || undefined,
            biographyMd: p.biographyMd || undefined, biographyShortMd: p.biographyShortMd || undefined,
            residencyText: p.residencyText || undefined,
          },
        })
      )
    );
    for (let i = 0; i < batch.length; i++) {
      personIdMap.set(batch[i].primaryExternalKey, results[i].id);
      count++;
    }
    process.stdout.write(`   ${count}/${canonical.people.length}\n`);
  }
  console.log(`   ✓ ${count} people upserted`);

  // Upsert events (batched interactive transactions)
  console.log("\n📅 Upserting events...");
  let evCount = 0;

  const eventChunks = chunk(canonical.events, MAX_OPS_PER_TXN);
  for (const batch of eventChunks) {
    await prisma.$transaction(async (tx) => {
      for (const e of batch) {
        const personDbId = personIdMap.get(e.personKey);
        if (!personDbId) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existing = await (tx as any).personEvent.findFirst({
          where: { personId: personDbId, role: e.role, event: { type: e.type } },
          include: { event: true },
        });

        if (existing) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (tx as any).event.update({
            where: { id: existing.eventId },
            data: { dateExact: e.dateExact, dateYear: e.dateYear, dateMonth: e.dateMonth, dateDay: e.dateDay, dateText: e.dateText, dateIsApprox: e.dateIsApprox },
          });
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const event = await (tx as any).event.create({
            data: { type: e.type, dateExact: e.dateExact, dateYear: e.dateYear, dateMonth: e.dateMonth, dateDay: e.dateDay, dateText: e.dateText, dateIsApprox: e.dateIsApprox },
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (tx as any).personEvent.create({ data: { personId: personDbId, eventId: event.id, role: e.role } });
        }
        evCount++;
      }
    }, { timeout: TXN_TIMEOUT });
    process.stdout.write(`   ${evCount}/${canonical.events.length}\n`);
  }
  console.log(`   ✓ ${evCount} events upserted`);

  // Parent-child (batched)
  console.log("\n🔗 Creating parent-child links...");
  let relCount = 0;
  const pcChunks = chunk(canonical.parentChild, MAX_OPS_PER_TXN);
  for (const batch of pcChunks) {
    const ops = batch
      .map((pc) => {
        const parentId = personIdMap.get(pc.parentKey);
        const childId = personIdMap.get(pc.childKey);
        if (!parentId || !childId) return null;
        return { parentId, childId, type: pc.type };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (ops.length > 0) {
      try {
        const results = await prisma.$transaction(
          ops.map((op) =>
            prisma.parentChild.upsert({
              where: { parentId_childId: { parentId: op.parentId, childId: op.childId } },
              create: { parentId: op.parentId, childId: op.childId, type: op.type },
              update: { type: op.type },
            })
          )
        );
        relCount += results.length;
      } catch { /* skip constraint violations */ }
    }
  }
  console.log(`   ✓ ${relCount} relationships`);

  // Partnerships (batched)
  console.log("\n💑 Creating partnerships...");
  let partCount = 0;
  const partChunks = chunk(canonical.partnerships, MAX_OPS_PER_TXN);
  for (const batch of partChunks) {
    const ops = batch
      .map((pp) => {
        const aId = personIdMap.get(pp.personAKey);
        const bId = personIdMap.get(pp.personBKey);
        if (!aId || !bId) return null;
        const [pAId, pBId] = aId < bId ? [aId, bId] : [bId, aId];
        return { personAId: pAId, personBId: pBId, type: pp.type, notesMd: pp.notesMd };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (ops.length > 0) {
      try {
        const results = await prisma.$transaction(
          ops.map((op) =>
            prisma.partnership.upsert({
              where: { personAId_personBId: { personAId: op.personAId, personBId: op.personBId } },
              create: { personAId: op.personAId, personBId: op.personBId, type: op.type, notesMd: op.notesMd },
              update: { notesMd: op.notesMd || undefined },
            })
          )
        );
        partCount += results.length;
      } catch { /* skip */ }
    }
  }
  console.log(`   ✓ ${partCount} partnerships`);

  // Contacts (batched)
  console.log("\n📞 Upserting contacts...");
  let contactCount = 0;
  const contactChunks = chunk(canonical.contacts, MAX_OPS_PER_TXN);
  for (const batch of contactChunks) {
    const ops = batch
      .map((c) => {
        const personId = personIdMap.get(c.personKey);
        if (!personId) return null;
        return { ...c, personId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (ops.length > 0) {
      const results = await prisma.$transaction(
        ops.map((c) =>
          prisma.contact.upsert({
            where: { personId: c.personId },
            create: {
              personId: c.personId, emails: c.emails, mobile: c.mobile, landline: c.landline,
              address2000: c.address2000, postalAddress2021: c.postalAddress2021,
              establishingContact: c.establishingContact, comments: c.comments,
              ageCurrentExcel: c.ageCurrentExcel, numberOfKids2000: c.numberOfKids2000,
            },
            update: {
              emails: c.emails, mobile: c.mobile, landline: c.landline,
              address2000: c.address2000, postalAddress2021: c.postalAddress2021,
              establishingContact: c.establishingContact, comments: c.comments,
            },
          })
        )
      );
      contactCount += results.length;
    }
  }
  console.log(`   ✓ ${contactCount} contacts`);

  // Validation pass
  console.log("\n🔍 Running validation...");
  const MAX_REASONABLE_LIFESPAN = 120;
  const CURRENT_YEAR = new Date().getFullYear();

  interface ValidationIssue {
    severity: "INFO" | "WARNING" | "ERROR";
    code: string;
    message: string;
    entityType?: string;
    entityId?: string;
    meta?: object;
  }

  const issues: ValidationIssue[] = [];
  for (const p of canonical.people) {
    if (p.isPlaceholder) continue;
    const dbId = personIdMap.get(p.primaryExternalKey);

    const birthEvent = canonical.events.find(
      (e) => e.personKey === p.primaryExternalKey && e.type === "BIRTH"
    );
    const deathEvent = canonical.events.find(
      (e) => e.personKey === p.primaryExternalKey && e.type === "DEATH"
    );

    if (!birthEvent || (!birthEvent.dateExact && !birthEvent.dateYear)) {
      issues.push({ severity: "WARNING", code: "MISSING_DOB", message: `Missing DOB: ${p.displayName}`, entityType: "PERSON", entityId: dbId });
    }
    if (deathEvent && !deathEvent.dateExact && deathEvent.dateYear) {
      issues.push({ severity: "INFO", code: "PARTIAL_DOD", message: `Year-only DOD: ${p.displayName}`, entityType: "PERSON", entityId: dbId });
    }
    if (p.gender === "UNKNOWN") {
      issues.push({ severity: "WARNING", code: "MISSING_GENDER", message: `Missing gender: ${p.displayName}`, entityType: "PERSON", entityId: dbId });
    }
    if (birthEvent?.dateYear && birthEvent.dateYear > CURRENT_YEAR) {
      issues.push({ severity: "ERROR", code: "FUTURE_BIRTH", message: `Future birth year ${birthEvent.dateYear}: ${p.displayName}`, entityType: "PERSON", entityId: dbId });
    }
    if (deathEvent?.dateYear && deathEvent.dateYear > CURRENT_YEAR) {
      issues.push({ severity: "ERROR", code: "FUTURE_DEATH", message: `Future death year ${deathEvent.dateYear}: ${p.displayName}`, entityType: "PERSON", entityId: dbId });
    }
    if (birthEvent?.dateYear && deathEvent?.dateYear && deathEvent.dateYear < birthEvent.dateYear) {
      issues.push({ severity: "ERROR", code: "DEATH_BEFORE_BIRTH", message: `Death before birth: ${p.displayName}`, entityType: "PERSON", entityId: dbId });
    }
    if (birthEvent?.dateYear && deathEvent?.dateYear) {
      const lifespan = deathEvent.dateYear - birthEvent.dateYear;
      if (lifespan > MAX_REASONABLE_LIFESPAN) {
        issues.push({ severity: "ERROR", code: "IMPOSSIBLE_LIFESPAN", message: `Impossible lifespan ${lifespan}y: ${p.displayName}`, entityType: "PERSON", entityId: dbId });
      }
    }
  }

  console.log(`   Found ${issues.length} issues`);
  console.log(`     Errors:   ${issues.filter(i => i.severity === "ERROR").length}`);
  console.log(`     Warnings: ${issues.filter(i => i.severity === "WARNING").length}`);
  console.log(`     Info:     ${issues.filter(i => i.severity === "INFO").length}`);

  // Store issues (batched)
  if (issues.length > 0) {
    const issueChunks = chunk(issues, MAX_OPS_PER_TXN);
    for (const batch of issueChunks) {
      await prisma.importIssue.createMany({
        data: batch.map((issue) => ({
          importRunId: importRun.id,
          ...issue,
        })),
      });
    }
  }

  // Mark complete
  const summary = {
    sheetsProcessed: parsed.sheets.length, rawRowsStored, peopleUpserted: count,
    eventsUpserted: evCount, relationshipsCreated: relCount, partnershipsCreated: partCount,
    contactsUpserted: contactCount, issuesCount: issues.length,
  };

  await prisma.importRun.update({
    where: { id: importRun.id },
    data: { status: "COMPLETED", finishedAt: new Date(), summary: summary as object },
  });

  await prisma.activity.create({
    data: {
      type: "IMPORT_RUN",
      message: `Import completed: ${count} people, ${evCount} events, ${relCount} relationships`,
      meta: summary as object,
    },
  });

  console.log("\n✅ Import complete!");
  console.log(JSON.stringify(summary, null, 2));

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});
