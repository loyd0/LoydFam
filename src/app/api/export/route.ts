import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loydOnlyWhere, parseLoydOnly } from "@/lib/loyd-filter";

/**
 * Data export endpoint. Supports CSV, JSON and GEDCOM (5.5.1) formats.
 * Honours the same filters as the People directory so a filtered view can be
 * exported as-is. ?format=csv|json|gedcom
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || "csv").toLowerCase();
  const q = searchParams.get("q")?.trim() || "";
  const gender = searchParams.get("gender")?.toUpperCase();
  const generation = searchParams.get("generation");
  const living = searchParams.get("living");
  const loydOnly = parseLoydOnly(searchParams);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const andClauses: any[] = [{ isPlaceholder: false }];
  if (loydOnly) andClauses.push(loydOnlyWhere());
  if (q) {
    andClauses.push({
      OR: [
        { displayName: { contains: q, mode: "insensitive" } },
        { surname: { contains: q, mode: "insensitive" } },
        { givenName1: { contains: q, mode: "insensitive" } },
        { knownAs: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (gender && ["MALE", "FEMALE", "UNKNOWN"].includes(gender)) {
    andClauses.push({ gender });
  }
  if (generation) {
    const gen = parseInt(generation, 10);
    if (!isNaN(gen)) {
      andClauses.push({ OR: [{ legacyGeneration: gen }, { generationFromWilliam: gen }] });
    }
  }
  if (living === "true") {
    andClauses.push({ events: { none: { event: { type: "DEATH" } } } });
  }
  const where = andClauses.length === 1 ? andClauses[0] : { AND: andClauses };

  const people = await prisma.person.findMany({
    where,
    orderBy: [{ legacyGeneration: "asc" }, { displayName: "asc" }],
    select: {
      id: true,
      displayName: true,
      surname: true,
      givenName1: true,
      givenName2: true,
      givenName3: true,
      knownAs: true,
      gender: true,
      legacyGeneration: true,
      generationFromWilliam: true,
      residencyText: true,
      events: {
        include: { event: true },
        where: { event: { type: { in: ["BIRTH", "DEATH", "MARRIAGE"] } } },
      },
    },
  });

  const personIds = new Set(people.map((p) => p.id));

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    const data = people.map((p) => {
      const birth = p.events.find((e) => e.event.type === "BIRTH")?.event;
      const death = p.events.find((e) => e.event.type === "DEATH")?.event;
      return {
        id: p.id,
        displayName: p.displayName,
        surname: p.surname,
        givenNames: [p.givenName1, p.givenName2, p.givenName3].filter(Boolean),
        knownAs: p.knownAs,
        gender: p.gender,
        generation: p.legacyGeneration ?? p.generationFromWilliam,
        residency: p.residencyText,
        birth: birth ? { year: birth.dateYear, date: birth.dateExact, text: birth.dateText } : null,
        death: death ? { year: death.dateYear, date: death.dateExact, text: death.dateText } : null,
        isLiving: !death,
      };
    });
    return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), count: data.length, people: data }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="loyd-family-${stamp}.json"`,
      },
    });
  }

  if (format === "gedcom") {
    const gedcom = await buildGedcom(people, personIds);
    return new NextResponse(gedcom, {
      headers: {
        "Content-Type": "text/vnd.familysearch.gedcom; charset=utf-8",
        "Content-Disposition": `attachment; filename="loyd-family-${stamp}.ged"`,
      },
    });
  }

  // Default: CSV
  const headers = [
    "ID", "Display Name", "Surname", "Given Names", "Known As",
    "Gender", "Generation", "Birth Year", "Death Year", "Living", "Residency",
  ];
  const rows = people.map((p) => {
    const birth = p.events.find((e) => e.event.type === "BIRTH")?.event;
    const death = p.events.find((e) => e.event.type === "DEATH")?.event;
    return [
      p.id,
      p.displayName,
      p.surname ?? "",
      [p.givenName1, p.givenName2, p.givenName3].filter(Boolean).join(" "),
      p.knownAs ?? "",
      p.gender,
      String(p.legacyGeneration ?? p.generationFromWilliam ?? ""),
      birth?.dateYear != null ? String(birth.dateYear) : "",
      death?.dateYear != null ? String(death.dateYear) : "",
      death ? "No" : "Yes",
      p.residencyText ?? "",
    ];
  });
  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  // BOM for Excel compatibility with UTF-8
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="loyd-family-${stamp}.csv"`,
    },
  });
}

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

type ExportPerson = {
  id: string;
  displayName: string;
  surname: string | null;
  givenName1: string | null;
  givenName2: string | null;
  givenName3: string | null;
  gender: string;
  events: { event: { type: string; dateYear: number | null; dateExact: Date | null; dateText: string | null } }[];
};

const GED_MONTHS = ["", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function gedDate(d: { dateYear: number | null; dateExact: Date | null; dateText: string | null }): string | null {
  if (d.dateExact) {
    const dt = new Date(d.dateExact);
    return `${dt.getUTCDate()} ${GED_MONTHS[dt.getUTCMonth() + 1]} ${dt.getUTCFullYear()}`;
  }
  if (d.dateYear) return String(d.dateYear);
  if (d.dateText) return d.dateText;
  return null;
}

async function buildGedcom(people: ExportPerson[], personIds: Set<string>): Promise<string> {
  const xref = new Map<string, string>();
  people.forEach((p, i) => xref.set(p.id, `I${i + 1}`));

  // Pull relationships limited to the exported set.
  const ids = Array.from(personIds);
  const [parentChild, partnerships] = await Promise.all([
    prisma.parentChild.findMany({
      where: { parentId: { in: ids }, childId: { in: ids } },
      select: { parentId: true, childId: true },
    }),
    prisma.partnership.findMany({
      where: { personAId: { in: ids }, personBId: { in: ids } },
      select: { personAId: true, personBId: true },
    }),
  ]);

  const genderOf = new Map(people.map((p) => [p.id, p.gender]));

  interface Family {
    parents: string[];
    children: Set<string>;
  }
  const families = new Map<string, Family>();
  const pairKey = (a: string, b: string) => [a, b].sort().join("|");

  function ensureFamily(key: string, parents: string[]): Family {
    let fam = families.get(key);
    if (!fam) {
      fam = { parents: parents.filter(Boolean), children: new Set() };
      families.set(key, fam);
    }
    return fam;
  }

  // Childless couples still get a family record.
  for (const pp of partnerships) {
    ensureFamily(pairKey(pp.personAId, pp.personBId), [pp.personAId, pp.personBId]);
  }

  // Group children by their set of parents.
  const childParents = new Map<string, string[]>();
  for (const pc of parentChild) {
    if (!childParents.has(pc.childId)) childParents.set(pc.childId, []);
    childParents.get(pc.childId)!.push(pc.parentId);
  }
  for (const [childId, parents] of childParents) {
    const key = parents.length >= 2 ? pairKey(parents[0], parents[1]) : `${parents[0]}|solo`;
    const fam = ensureFamily(key, parents.slice(0, 2));
    fam.children.add(childId);
  }

  // Assign family xrefs and build per-person family pointers.
  const famXref = new Map<string, string>();
  const spouseFams = new Map<string, string[]>(); // personId -> [FAM as spouse]
  const childFams = new Map<string, string>(); // personId -> FAM as child
  let fi = 1;
  for (const [key, fam] of families) {
    const fx = `F${fi++}`;
    famXref.set(key, fx);
    for (const parent of fam.parents) {
      if (!spouseFams.has(parent)) spouseFams.set(parent, []);
      spouseFams.get(parent)!.push(fx);
    }
    for (const child of fam.children) childFams.set(child, fx);
  }

  const lines: string[] = [];
  lines.push("0 HEAD");
  lines.push("1 SOUR LoydFamilyHistory");
  lines.push("2 NAME Loyd Family History System");
  lines.push("1 GEDC");
  lines.push("2 VERS 5.5.1");
  lines.push("2 FORM LINEAGE-LINKED");
  lines.push("1 CHAR UTF-8");
  lines.push(`1 DATE ${gedDate({ dateYear: null, dateExact: new Date(), dateText: null })}`);

  for (const p of people) {
    const id = xref.get(p.id)!;
    lines.push(`0 @${id}@ INDI`);
    const given = [p.givenName1, p.givenName2, p.givenName3].filter(Boolean).join(" ");
    const surname = p.surname ?? "";
    lines.push(`1 NAME ${given} /${surname}/`.trimEnd());
    if (given) lines.push(`2 GIVN ${given}`);
    if (surname) lines.push(`2 SURN ${surname}`);
    lines.push(`1 SEX ${p.gender === "MALE" ? "M" : p.gender === "FEMALE" ? "F" : "U"}`);

    const birth = p.events.find((e) => e.event.type === "BIRTH")?.event;
    if (birth) {
      const bd = gedDate(birth);
      lines.push("1 BIRT");
      if (bd) lines.push(`2 DATE ${bd}`);
    }
    const death = p.events.find((e) => e.event.type === "DEATH")?.event;
    if (death) {
      const dd = gedDate(death);
      lines.push("1 DEAT");
      if (dd) lines.push(`2 DATE ${dd}`);
    }
    for (const fx of spouseFams.get(p.id) ?? []) lines.push(`1 FAMS @${fx}@`);
    const cf = childFams.get(p.id);
    if (cf) lines.push(`1 FAMC @${cf}@`);
  }

  for (const [key, fam] of families) {
    const fx = famXref.get(key)!;
    lines.push(`0 @${fx}@ FAM`);
    for (const parent of fam.parents) {
      const px = xref.get(parent);
      if (!px) continue;
      const role = genderOf.get(parent) === "FEMALE" ? "WIFE" : "HUSB";
      lines.push(`1 ${role} @${px}@`);
    }
    for (const child of fam.children) {
      const cx = xref.get(child);
      if (cx) lines.push(`1 CHIL @${cx}@`);
    }
  }

  lines.push("0 TRLR");
  return lines.join("\n");
}
