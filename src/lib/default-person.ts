import { prisma } from "@/lib/prisma";

// Book order is authoritative; insertion order and alphabetic order are not.
export async function getBookRoot() {
  return prisma.person.findFirst({
    where: { primaryExternalKey: "LOYD:1", isPlaceholder: false },
    select: { id: true, displayName: true, primaryExternalKey: true, surname: true },
  });
}
