/**
 * run-import.ts — Orchestrates the full import pipeline:
 *  1. Store raw sheets + rows in DB (never-lose-anything layer)
 *  2. Run canonical extraction
 *  3. Upsert people, events, relationships, contacts into DB
 *  4. Produce validation flags
 *  5. Return summary
 *
 * All mutations are wrapped in batched transactions (max 1000 ops per txn).
 */

import { prisma } from "@/lib/prisma";
import { parseWorkbook, hashRow } from "./parse-workbook";
import { extractCanonical } from "./canonical-extract";
import type {
  PersonPayload,
  EventPayload,
  ContactPayload,
} from "./canonical-extract";

/** Maximum Prisma operations per $transaction call */
const MAX_OPS_PER_TXN = 50;

export interface ImportSummary {
  importRunId: string;
  sheetsProcessed: number;
  rawRowsStored: number;
  peopleUpserted: number;
  eventsUpserted: number;
  relationshipsCreated: number;
  partnershipsCreated: number;
  contactsUpserted: number;
  issuesCount: number;
}

/**
 * Split an array into chunks of at most `size` elements.
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function runImport(
  fileBuffer: Buffer,
  originalFilename: string,
  userId?: string
): Promise<ImportSummary> {
  // 1. Parse workbook
  const parsed = parseWorkbook(fileBuffer);

  // 2. Create source file record (upsert by sha256)
  const sourceFile = await prisma.sourceFile.upsert({
    where: { sha256: parsed.sha256 },
    create: {
      originalFilename,
      sha256: parsed.sha256,
      uploadedByUserId: userId,
    },
    update: {
      originalFilename,
      uploadedByUserId: userId,
    },
  });

  // 3. Create import run
  const importRun = await prisma.importRun.create({
    data: {
      sourceFileId: sourceFile.id,
      status: "RUNNING",
      startedAt: new Date(),
      appVersion: "1.0.0",
    },
  });

  try {
    // 4. Store raw sheets + rows (batched)
    let rawRowsStored = 0;
    for (const sheet of parsed.sheets) {
      const importSheet = await prisma.importSheet.create({
        data: {
          importRunId: importRun.id,
          sheetName: sheet.sheetName,
          rowCount: sheet.rows.length,
        },
      });

      // Batch insert rows in chunks of MAX_OPS_PER_TXN
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
    }

    // 5. Extract canonical data
    const canonical = extractCanonical(parsed.sheets);

    // 6. Upsert people (batched transactions)
    const personIdMap = new Map<string, string>(); // primaryExternalKey -> db id
    let peopleUpserted = 0;

    const peopleChunks = chunk(canonical.people, MAX_OPS_PER_TXN);
    for (const batch of peopleChunks) {
      const results = await prisma.$transaction(
        batch.map((p) => upsertPersonQuery(p))
      );
      for (let i = 0; i < batch.length; i++) {
        personIdMap.set(batch[i].primaryExternalKey, results[i].id);
        peopleUpserted++;
      }
    }

    // 7. Upsert events + person_events (batched — sequential within each event, batched across events)
    let eventsUpserted = 0;
    const eventIdMap = new Map<string, string>(); // event key -> db id

    const eventChunks = chunk(canonical.events, MAX_OPS_PER_TXN);
    for (const batch of eventChunks) {
      // Events require find-then-upsert, so we do them in a sequential transaction
      await prisma.$transaction(async (tx) => {
        for (const e of batch) {
          const personDbId = personIdMap.get(e.personKey);
          if (!personDbId) continue;

          const event = await upsertEventInTx(tx, e, personDbId);
          eventIdMap.set(e.key, event.id);
          eventsUpserted++;
        }
      }, { timeout: 30_000 });
    }

    // 8. Create parent-child relationships (batched)
    let relationshipsCreated = 0;
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
        const results = await prisma.$transaction(
          ops.map((op) =>
            prisma.parentChild.upsert({
              where: { parentId_childId: { parentId: op.parentId, childId: op.childId } },
              create: { parentId: op.parentId, childId: op.childId, type: op.type },
              update: { type: op.type },
            })
          )
        );
        relationshipsCreated += results.length;
      }
    }

    // 9. Create partnerships (batched)
    let partnershipsCreated = 0;
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
        const results = await prisma.$transaction(
          ops.map((op) =>
            prisma.partnership.upsert({
              where: { personAId_personBId: { personAId: op.personAId, personBId: op.personBId } },
              create: { personAId: op.personAId, personBId: op.personBId, type: op.type, notesMd: op.notesMd },
              update: { notesMd: op.notesMd || undefined },
            })
          )
        );
        partnershipsCreated += results.length;
      }
    }

    // 10. Upsert contacts (batched)
    let contactsUpserted = 0;
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
                personId: c.personId,
                emails: c.emails,
                mobile: c.mobile,
                landline: c.landline,
                address2000: c.address2000,
                postalAddress2021: c.postalAddress2021,
                establishingContact: c.establishingContact,
                comments: c.comments,
                ageCurrentExcel: c.ageCurrentExcel,
                numberOfKids2000: c.numberOfKids2000,
              },
              update: {
                emails: c.emails,
                mobile: c.mobile,
                landline: c.landline,
                address2000: c.address2000,
                postalAddress2021: c.postalAddress2021,
                establishingContact: c.establishingContact,
                comments: c.comments,
                ageCurrentExcel: c.ageCurrentExcel,
                numberOfKids2000: c.numberOfKids2000,
              },
            })
          )
        );
        contactsUpserted += results.length;
      }
    }

    // 11. Validation pass — create import issues
    const issues = runValidation(canonical, personIdMap);
    if (issues.length > 0) {
      // Batch insert issues
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

    // 12. Mark import run as completed
    const summary: ImportSummary = {
      importRunId: importRun.id,
      sheetsProcessed: parsed.sheets.length,
      rawRowsStored,
      peopleUpserted,
      eventsUpserted,
      relationshipsCreated,
      partnershipsCreated,
      contactsUpserted,
      issuesCount: issues.length,
    };

    await prisma.importRun.update({
      where: { id: importRun.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        summary: summary as object,
      },
    });

    // 13. Create activity record
    await prisma.activity.create({
      data: {
        type: "IMPORT_RUN",
        actorUserId: userId,
        message: `Import completed: ${peopleUpserted} people, ${eventsUpserted} events, ${relationshipsCreated} relationships`,
        meta: summary as object,
      },
    });

    return summary;
  } catch (error) {
    // Mark import as failed
    await prisma.importRun.update({
      where: { id: importRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        summary: { error: String(error) },
      },
    });
    throw error;
  }
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Returns a Prisma upsert query (not awaited) for use in $transaction([...]).
 */
function upsertPersonQuery(p: PersonPayload) {
  return prisma.person.upsert({
    where: { primaryExternalKey: p.primaryExternalKey },
    create: {
      primaryExternalKey: p.primaryExternalKey,
      sourceSystem: p.sourceSystem,
      externalId: p.externalId,
      surname: p.surname,
      givenName1: p.givenName1,
      givenName2: p.givenName2,
      givenName3: p.givenName3,
      knownAs: p.knownAs,
      preferredName: p.preferredName,
      displayName: p.displayName,
      gender: p.gender,
      isPlaceholder: p.isPlaceholder,
      biographyMd: p.biographyMd,
      biographyShortMd: p.biographyShortMd,
      residencyText: p.residencyText,
      dspFlag: p.dspFlag,
      expectedPhotoCount: p.expectedPhotoCount,
      legacyGeneration: p.legacyGeneration,
      generationFromWilliam: p.generationFromWilliam,
      descendantGeneration: p.descendantGeneration,
      lengthMetric: p.lengthMetric,
      rawNameString: p.rawNameString,
      branchRootExternalId: p.branchRootExternalId,
    },
    update: {
      surname: p.surname || undefined,
      givenName1: p.givenName1 || undefined,
      givenName2: p.givenName2 || undefined,
      givenName3: p.givenName3 || undefined,
      knownAs: p.knownAs || undefined,
      preferredName: p.preferredName || undefined,
      displayName: p.displayName,
      gender: p.gender,
      biographyMd: p.biographyMd || undefined,
      biographyShortMd: p.biographyShortMd || undefined,
      residencyText: p.residencyText || undefined,
      dspFlag: p.dspFlag ?? undefined,
      expectedPhotoCount: p.expectedPhotoCount ?? undefined,
      legacyGeneration: p.legacyGeneration ?? undefined,
      generationFromWilliam: p.generationFromWilliam ?? undefined,
      descendantGeneration: p.descendantGeneration || undefined,
      lengthMetric: p.lengthMetric || undefined,
      rawNameString: p.rawNameString || undefined,
      branchRootExternalId: p.branchRootExternalId || undefined,
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0] extends infer T ? T : never;

/**
 * Upsert an event within an interactive transaction.
 */
async function upsertEventInTx(
  tx: TxClient,
  e: EventPayload,
  personDbId: string
) {
  // Find existing person_event for this person + type + role
  const existing = await (tx as any).personEvent.findFirst({
    where: {
      personId: personDbId,
      role: e.role,
      event: { type: e.type },
    },
    include: { event: true },
  });

  if (existing) {
    await (tx as any).event.update({
      where: { id: existing.eventId },
      data: {
        dateExact: e.dateExact,
        dateYear: e.dateYear,
        dateMonth: e.dateMonth,
        dateDay: e.dateDay,
        dateText: e.dateText,
        dateIsApprox: e.dateIsApprox,
      },
    });
    return existing.event;
  }

  // Create new event + link
  const event = await (tx as any).event.create({
    data: {
      type: e.type,
      dateExact: e.dateExact,
      dateYear: e.dateYear,
      dateMonth: e.dateMonth,
      dateDay: e.dateDay,
      dateText: e.dateText,
      dateIsApprox: e.dateIsApprox,
    },
  });

  await (tx as any).personEvent.create({
    data: {
      personId: personDbId,
      eventId: event.id,
      role: e.role,
    },
  });

  return event;
}

// ─── Validation ───────────────────────────────────────────────

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

function runValidation(
  canonical: ReturnType<typeof extractCanonical>,
  personIdMap: Map<string, string>
): ValidationIssue[] {
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

    // Missing DOB
    if (!birthEvent || (!birthEvent.dateExact && !birthEvent.dateYear)) {
      issues.push({
        severity: "WARNING",
        code: "MISSING_DOB",
        message: `Missing date of birth for ${p.displayName}`,
        entityType: "PERSON",
        entityId: dbId,
      });
    }

    // Partial DOD (year only)
    if (deathEvent && !deathEvent.dateExact && deathEvent.dateYear) {
      issues.push({
        severity: "INFO",
        code: "PARTIAL_DOD",
        message: `Only year of death known for ${p.displayName}`,
        entityType: "PERSON",
        entityId: dbId,
      });
    }

    // Missing gender
    if (p.gender === "UNKNOWN") {
      issues.push({
        severity: "WARNING",
        code: "MISSING_GENDER",
        message: `Missing gender for ${p.displayName}`,
        entityType: "PERSON",
        entityId: dbId,
      });
    }

    // Future dates
    if (birthEvent?.dateYear && birthEvent.dateYear > CURRENT_YEAR) {
      issues.push({
        severity: "ERROR",
        code: "FUTURE_BIRTH",
        message: `Birth year ${birthEvent.dateYear} is in the future for ${p.displayName}`,
        entityType: "PERSON",
        entityId: dbId,
      });
    }
    if (deathEvent?.dateYear && deathEvent.dateYear > CURRENT_YEAR) {
      issues.push({
        severity: "ERROR",
        code: "FUTURE_DEATH",
        message: `Death year ${deathEvent.dateYear} is in the future for ${p.displayName}`,
        entityType: "PERSON",
        entityId: dbId,
      });
    }

    // Death before birth
    if (birthEvent?.dateYear && deathEvent?.dateYear && deathEvent.dateYear < birthEvent.dateYear) {
      issues.push({
        severity: "ERROR",
        code: "DEATH_BEFORE_BIRTH",
        message: `Death (${deathEvent.dateYear}) before birth (${birthEvent.dateYear}) for ${p.displayName}`,
        entityType: "PERSON",
        entityId: dbId,
        meta: { birthYear: birthEvent.dateYear, deathYear: deathEvent.dateYear },
      });
    }

    // Impossible lifespan
    if (birthEvent?.dateYear && deathEvent?.dateYear) {
      const lifespan = deathEvent.dateYear - birthEvent.dateYear;
      if (lifespan > MAX_REASONABLE_LIFESPAN) {
        issues.push({
          severity: "ERROR",
          code: "IMPOSSIBLE_LIFESPAN",
          message: `Impossible lifespan of ${lifespan} years for ${p.displayName} (born ${birthEvent.dateYear}, died ${deathEvent.dateYear})`,
          entityType: "PERSON",
          entityId: dbId,
          meta: { birthYear: birthEvent.dateYear, deathYear: deathEvent.dateYear, lifespan },
        });
      }
    }

    // Parent younger than child
    if (birthEvent?.dateYear) {
      const parentEdges = canonical.parentChild.filter(
        (pc) => pc.childKey === p.primaryExternalKey
      );
      for (const edge of parentEdges) {
        const parentBirth = canonical.events.find(
          (e) => e.personKey === edge.parentKey && e.type === "BIRTH"
        );
        if (parentBirth?.dateYear && parentBirth.dateYear >= birthEvent.dateYear) {
          issues.push({
            severity: "ERROR",
            code: "PARENT_AFTER_CHILD",
            message: `Parent ${edge.parentKey} (born ${parentBirth.dateYear}) is not older than child ${p.displayName} (born ${birthEvent.dateYear})`,
            entityType: "PERSON",
            entityId: dbId,
            meta: { parentKey: edge.parentKey, childKey: p.primaryExternalKey },
          });
        }
      }
    }
  }

  return issues;
}
