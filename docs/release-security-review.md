# September 2026 release review

[Cursor reviewed PR #4](https://github.com/loyd0/LoydFam/pull/4#issuecomment-5910238483) at `b18f607`, with a “Ready with fixes” verdict. The release follow-up addresses its 15 actionable findings:

- #1: linked-person loading runs on mount, with stale-response protection.
- #2: ancestor queries are batched by generation; omitted depth still means full depth.
- #4, #5, #7, #8, #12: regression coverage for amendment concurrency, verified record ownership, invitation/reset single use and private workbook URL validation.
- #9: property writes cannot accidentally replace populated research sections with empty arrays.
- #14: a unique database constraint prevents duplicate ownership of the same media blob.
- #16: linked-person dates consider all birth/death events in deterministic order.
- #18: CSV formula prefixes and GEDCOM record separators are escaped.
- #19: authenticated server uploads force private storage and validate file signatures. No browser upload token is issued. Uploads are limited to 4 MB to fit the hosting request limit.
- #20: person pages query relevant published property articles rather than loading every article.
- #21: wholly denied search returns 403.
- #22: an uncertain email send does not invalidate a reset link that might still arrive; definite rejection does.

The full-depth defaults and existing permission model are retained. The new media constraint was checked for duplicates and applied after a database backup. Mail uses a shared branded template with plain-text alternatives; a test send was accepted by Cloudflare.

The review also identified pre-existing limitations outside these findings: changing a password does not revoke every existing session, and failed imports can leave committed batches. A source-download grant includes the contact data in the original workbook. These are not claims of complete security coverage; the original review records its scope and residual risks.
