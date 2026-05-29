"use client";

/**
 * Standalone visual demo of the family tree, fed hardcoded sample data.
 * Lets the tree be reviewed without a database connection or login.
 * Not linked from the app — reachable directly at /tree-demo.
 */
import {
  FamilyTreeCanvas,
  type TreeData,
  type TreePerson,
} from "@/components/family-tree-canvas";

const p = (
  id: string,
  displayName: string,
  gender: "MALE" | "FEMALE",
  generation: number,
  birthYear: number | null,
  deathYear: number | null,
  opts: Partial<TreePerson> = {}
): TreePerson => ({
  id,
  displayName,
  gender,
  generation,
  birthYear,
  deathYear,
  isLiving: deathYear === null,
  surname: opts.surname ?? "Loyd",
  knownAs: opts.knownAs ?? null,
  residencyText: opts.residencyText ?? null,
  spouseNames: opts.spouseNames ?? [],
  isLoyd: opts.isLoyd ?? true,
});

const DEMO_DATA: TreeData = {
  rootId: "w",
  nodes: [
    p("w", "William Loyd", "MALE", 1, 1820, 1889, {
      spouseNames: ["Mary Loyd (née Hale)"],
      residencyText: "Shrewsbury, Shropshire",
      knownAs: "Will",
    }),
    // Gen 2
    p("t", "Thomas Loyd", "MALE", 2, 1845, 1910, {
      spouseNames: ["Eliza Loyd (née Brooke)"],
      residencyText: "Shrewsbury",
    }),
    p("c", "Charlotte Davies", "FEMALE", 2, 1848, 1921, {
      surname: "Davies",
      spouseNames: ["Henry Davies"],
    }),
    // Gen 3
    p("e", "Edward Loyd", "MALE", 3, 1872, 1944, {
      spouseNames: ["Agnes Loyd (née Fry)"],
    }),
    p("m", "Margaret Loyd", "FEMALE", 3, 1875, 1959, {}),
    p("g", "George Davies", "MALE", 3, 1873, 1940, {
      surname: "Davies",
      isLoyd: false,
    }),
    // Gen 4
    p("a", "Arthur Loyd", "MALE", 4, 1901, 1985, {
      residencyText: "Chester",
    }),
    p("h", "Helen Cormack-Loyd", "FEMALE", 4, 1904, 1990, {
      surname: "Cormack-Loyd",
      spouseNames: ["Robert Cormack-Loyd"],
    }),
    p("j", "James Loyd", "MALE", 4, 1908, 1972, {}),
    p("ps", "Peter Shaw", "MALE", 4, 1906, 1981, {
      surname: "Shaw",
      isLoyd: false,
    }),
    // Gen 5 (living)
    p("s", "Susan Loyd", "FEMALE", 5, 1935, null, {
      knownAs: "Sue",
      residencyText: "Bristol",
    }),
    p("d", "David Loyd", "MALE", 5, 1938, null, {
      spouseNames: ["Jane Loyd (née Webb)"],
      residencyText: "Cardiff",
    }),
  ],
  edges: [
    { parentId: "w", childId: "t" },
    { parentId: "w", childId: "c" },
    { parentId: "t", childId: "e" },
    { parentId: "t", childId: "m" },
    { parentId: "c", childId: "g" },
    { parentId: "e", childId: "a" },
    { parentId: "e", childId: "h" },
    { parentId: "e", childId: "j" },
    { parentId: "m", childId: "ps" },
    { parentId: "a", childId: "s" },
    { parentId: "a", childId: "d" },
  ],
};

export default function TreeDemoPage() {
  return (
    <div className="min-h-dvh bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Demo · sample data
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Family Tree</h1>
          <p className="mt-1 max-w-prose text-muted-foreground">
            A preview of the interactive tree rendered from hardcoded sample
            data. Click any person to open their profile card; the highlighted
            node marks the selected ancestor.
          </p>
        </header>

        <div className="overflow-hidden rounded-xl border border-border/50 bg-card/80 backdrop-blur">
          <FamilyTreeCanvas data={DEMO_DATA} />
        </div>
      </div>
    </div>
  );
}
