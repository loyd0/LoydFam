import { mediaUrl } from "@/lib/media-url";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/research-store";
import { apiPermissionError } from "@/lib/permission-guards";
import { getUserPermissions } from "@/lib/permission-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await apiPermissionError("people.view", session.user);
  if (denied) return denied;
  const permissions = await getUserPermissions(session.user);

  const { id } = await params;

  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      aliases: true,
      events: {
        include: { event: { include: { place: true, _count: { select: { personEvents: true, partnershipStarts: true, partnershipEnds: true } } } } },
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

  const owned = session.user.role === "ADMIN" || (await prisma.user.findUnique({ where: { id: session.user.id }, select: { verifiedPersonId: true } }))?.verifiedPersonId === person.id;
  return NextResponse.json({
    ...person,
    events: person.events.map(link => ({ ...link, canEdit: session.user.role === "ADMIN" || (owned && link.event._count.personEvents === 1 && link.event._count.partnershipStarts === 0 && link.event._count.partnershipEnds === 0), event: { ...link.event, _count: undefined } })),
    properties: permissions["properties.view"] ? (await getProperties()).filter(p => p.people.some(link => link.id === person.id)).map(({ slug, name, location }) => ({ slug, name, location })) : [],
    mediaLinks: person.mediaLinks.map(link => ({ ...link, media: { ...link.media, blobUrl: mediaUrl(link.media.id), blobKey: undefined } })),
    notes: person.notes.map((note) => ({
      ...note,
      createdBy: note.createdBy ? { ...note.createdBy, email: session.user.role === "ADMIN" ? note.createdBy.email : null } : null,
    })),
    contact: owned ? person.contact : null,
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
