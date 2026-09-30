export interface AncestorNode {
  id: string;
  displayName: string;
  gender: string;
  birthYear: number | null;
  deathYear: number | null;
  isLiving: boolean;
  pedigreePosition: number;
  relationshipType: string | null;
}

interface PersonRow {
  id: string;
  displayName: string;
  gender: string;
  events: { event: { type: string; dateYear: number | null } }[];
}

interface ParentRow {
  childId: string;
  parentId: string;
  type: string;
  parent: { gender: string };
}

export interface AncestorReader {
  people(ids: string[]): Promise<PersonRow[]>;
  parents(childIds: string[]): Promise<ParentRow[]>;
}

export function parseAncestorDepth(value: string | null): number | null {
  const requested = value && value !== "full" ? Number.parseInt(value, 10) : null;
  return requested != null && Number.isFinite(requested) ? Math.max(1, requested) : null;
}

export async function walkAncestors(personId: string, depth: number | null, reader: AncestorReader) {
  const ancestors: AncestorNode[] = [];
  type QueueEntry = [string, number, Set<string>, string | null];
  let level: QueueEntry[] = [[personId, 1, new Set([personId]), null]];
  let maxDepth = 0;

  for (let currentDepth = 0; level.length > 0; currentDepth++) {
    const ids = [...new Set(level.map(([id]) => id))];
    const peopleById = new Map((await reader.people(ids)).map(person => [person.id, person]));
    const presentLevel = level.filter(([id]) => peopleById.has(id));
    if (presentLevel.length === 0) break;

    for (const [id, ahnNum, , relationshipType] of presentLevel) {
      const person = peopleById.get(id)!;
      const birth = person.events.find(entry => entry.event.type === "BIRTH");
      const death = person.events.find(entry => entry.event.type === "DEATH");
      ancestors.push({
        id: person.id, displayName: person.displayName, gender: person.gender,
        birthYear: birth?.event.dateYear ?? null, deathYear: death?.event.dateYear ?? null,
        isLiving: !death, pedigreePosition: ahnNum, relationshipType,
      });
      maxDepth = currentDepth;
    }
    if (depth != null && currentDepth >= depth) break;

    const parentsByChild = new Map<string, ParentRow[]>();
    for (const relation of await reader.parents(presentLevel.map(([id]) => id))) {
      const entries = parentsByChild.get(relation.childId) ?? [];
      entries.push(relation);
      parentsByChild.set(relation.childId, entries);
    }
    const nextLevel: QueueEntry[] = [];
    for (const [id, ahnNum, path] of presentLevel) {
      const parents = parentsByChild.get(id) ?? [];
      const father = parents.find(relation => relation.parent.gender === "MALE");
      const mother = parents.find(relation => relation.parent.gender !== "MALE");
      if (father && !path.has(father.parentId)) nextLevel.push([father.parentId, ahnNum * 2, new Set([...path, father.parentId]), father.type]);
      if (mother && !path.has(mother.parentId)) nextLevel.push([mother.parentId, ahnNum * 2 + 1, new Set([...path, mother.parentId]), mother.type]);
    }
    level = nextLevel;
  }
  return { ancestors, maxDepth };
}
