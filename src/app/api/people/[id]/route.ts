import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      aliases: true,
      events: {
        include: { event: true },
        orderBy: { event: { dateYear: "asc" } },
      },
      parentRelations: {
        include: {
          parent: { select: { id: true, displayName: true, gender: true } },
        },
      },
      childRelations: {
        include: {
          child: { select: { id: true, displayName: true, gender: true } },
        },
      },
      partnershipsA: {
        include: {
          personB: {
            select: { id: true, displayName: true, gender: true, isPlaceholder: true },
          },
          startEvent: true,
        },
      },
      partnershipsB: {
        include: {
          personA: {
            select: { id: true, displayName: true, gender: true, isPlaceholder: true },
          },
          startEvent: true,
        },
      },
      contact: true,
      notes: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      mediaLinks: {
        include: { media: true },
        orderBy: { sortOrder: "asc" },
      },
      tagLinks: {
        include: { tag: true },
      },
    },
  });

  if (!person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  const spouses = [
    ...person.partnershipsA.map((p) => ({
      id: p.personB.id,
      displayName: p.personB.displayName,
      gender: p.personB.gender,
      isPlaceholder: p.personB.isPlaceholder,
      type: p.type,
      notes: p.notesMd,
      partnershipId: p.id,
      marriageDate: p.startEvent
        ? {
            exact: p.startEvent.dateExact,
            year: p.startEvent.dateYear,
            text: p.startEvent.dateText,
          }
        : null,
    })),
    ...person.partnershipsB.map((p) => ({
      id: p.personA.id,
      displayName: p.personA.displayName,
      gender: p.personA.gender,
      isPlaceholder: p.personA.isPlaceholder,
      type: p.type,
      notes: p.notesMd,
      partnershipId: p.id,
      marriageDate: p.startEvent
        ? {
            exact: p.startEvent.dateExact,
            year: p.startEvent.dateYear,
            text: p.startEvent.dateText,
          }
        : null,
    })),
  ];

  return NextResponse.json({
    ...person,
    parents: person.parentRelations.map((r) => ({ ...r.parent, relationId: r.id })),
    children: person.childRelations.map((r) => ({ ...r.child, relationId: r.id })),
    spouses,
    tags: person.tagLinks.map((tl) => ({
      id: tl.tag.id,
      name: tl.tag.name,
      colour: tl.tag.colour,
      linkId: tl.id,
    })),
    parentRelations: undefined,
    childRelations: undefined,
    partnershipsA: undefined,
    partnershipsB: undefined,
    tagLinks: undefined,
  });
}
