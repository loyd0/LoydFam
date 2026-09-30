# Workbook import fidelity audit

This audit used the supplied 24-sheet workbook and the `.env.local` preview database. It did not write to the database. All workbook checks report counts only; no raw person names or residence strings are included.

## Person fields

The canonical extractor produced 1,002 person records (696 non-placeholder records). All 1,002 have a display name, 1,001 have a given name, and 695 have a surname.

The three selected name sources contain 275 non-empty `Known as` rows across 232 distinct stable person keys. Before the Hatch & Match merge fix, only 84 aliases survived into canonical records because that sheet created records only for unknown people and did not enrich existing ones. The extractor now fills missing name fields from the exact `LOYD #` match while retaining already populated fields. The workbook now yields 232 canonical `knownAs` values.

The two selected biography/residence sheets contain 382 non-empty `Countries lived in` rows across 191 distinct `Loyd #` keys. Canonical extraction yields residency text for 191 people, so the duplicate source rows collapse to the same stable person keys without losing coverage.

## Photo fields

The `Generations&Photos- CostsAT1` sheet has 190 person rows. Its `Photo` field contains 139 entries coded `1`, 47 coded `2`, and 4 coded `4`. The sheet note defines `1` as “yes” and `2` as “Died Young”; the meaning of `4` is not documented. `Photo Provider #` is populated on 33 rows, but those values are not numeric counts. The sheet also has aggregate copy and cost totals, not a per-person photo expectation column.

For these reasons, the extractor leaves `expectedPhotoCount` null for all 1,002 canonical records. Converting status codes to expected counts would invent a meaning the workbook does not provide.

## Event reconciliation

| Event type | Workbook extraction | Preview database | Difference |
| --- | ---: | ---: | ---: |
| Birth | 696 | 696 | 0 |
| Death | 258 | 262 | +4 |
| Marriage | 303 | 647 | +344 |
| **Total** | **1,257** | **1,605** | **+348** |

The workbook also extracts 306 partnerships. The shared importer processes canonical events one at a time and separately upserts partnerships. Its event helper updates the first matching event for a person/type/role, or creates one event for that canonical event; the partnership upsert does not create spouse-side events. The importer does not remove events absent from a later workbook. The current code therefore does not explain the extra 344 marriage and 4 death rows. They are persisted database records beyond this workbook’s current extraction; without per-event source provenance, attributing them to an older import or manual entry would be speculation.
