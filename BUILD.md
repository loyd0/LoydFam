Below is a **build document** and a **comprehensive data model** that is explicitly designed to ingest **everything in the workbook** (including the messy/derived sheets), whilst still producing a clean canonical schema for the app.

---

# Build document: Family History System (Next.js + Neon + Vercel)

## 1) Product goals (v1)

**Primary**

* Import the entire Excel workbook into **Neon Postgres** in a way that is **idempotent** (safe to re-run) and **auditable** (you can see exactly what came from where).
* Clean, modern app (Next.js + Tailwind) with:

  * authentication (invite-only email magic links using **Resend**) ([authjs.dev][1])
  * visual family tree (**focus mode + full-tree mode**)
  * attach photos to people
  * global search
  * timeline view
  * tagging
  * markdown notes (TipTap editor; markdown stored)
  * stats module (deep, filterable, fast)

**Secondary**

* Missing-data flagging + QA rules (no auto-merge; **flag only** for potential duplicates/conflicts).
* Source attachments (PDFs/images) linkable to a person/event.
* Exports (CSV + GEDCOM + JSON).

**Out of scope (for now)**

* Evidence/confidence scoring for each claim (we’ll still store attachments and link them, but not enforce a “proof” workflow).
* Migration flow-map (later).
* “Request photo” nudges (no).

---

## 2) Key principles (so “everything from Excel” is preserved)

1. **Never lose information**:

   * Store the entire workbook (file) + every sheet + every row as **raw JSONB** in Neon.
2. **Canonicalise without destroying provenance**:

   * Canonical entities (people, relationships, events) always keep pointers back to the raw row(s) they came from.
3. **Typed where it matters, flexible where Excel is messy**:

   * Map known fields into typed columns (DOB, names, etc).
   * Everything else becomes **attributes** (key/value) so you don’t have to constantly change schema when the workbook changes.
4. **Re-runnable imports**:

   * Upsert by stable keys (`source_system + external_id`) and record an import “diff”.

---

## 3) Tech stack

* **Next.js** (App Router), hosted on **Vercel**
* **Tailwind CSS** + shadcn/ui (clean, modern components)
* **Auth.js / NextAuth** with **Resend** email provider ([authjs.dev][1])
* **Neon Postgres**

  * Enable `pg_trgm` + `unaccent` for high-quality search ([Neon][2])
* **Vercel Blob** for photos + attachments ([Vercel][3])
* ORM: Prisma *or* Drizzle (either works; Prisma is simpler for rich relations + migrations)

---

## 4) Workbook ingestion strategy (what we actually import)

Your workbook has 24 sheets. Some are “true source” and some are derived/print/calculation. We do both:

### A) Full raw ingestion (ALL sheets)

* Store every sheet and every row as raw JSONB (even print/derived sheets).
* This guarantees “everything from Excel” is retained for reference, debugging, and future re-mapping.

### B) Canonical extraction (selected sheets are authoritative)

We treat these as primary sources for canonical fields:

**Core people + relationships**

* `Loyd List 1-190 - Edit` (core people 0–190; father/mother IDs; DOB entered; DoM; etc)
* `All Girls & Descendants` (417 descendants with alphanumeric IDs like 2a, 11b; additional info; spouse text; etc)
* `Hatch&Match Details` (includes -1 ancestor “Thomas”, plus date parts; helps fill gaps)

**Narrative + spouse + countries**

* `Updated Bios & Spouse Details` and/or `BiographyMarriageDetsCountries` (bio text, residency/countries, spouse text)

**Contacts**

* `Contacts` (addresses, email(s), phone(s), “establishing contact”, etc)

**Photo expectations**

* `Generations&Photos- CostsAT1` (photo counts per person—values behave like 1/2/4 photos)

**Derived lists (used for validation + attributes, not relationships-of-record)**

* `Book Details - NO EDIT` (DSP flag, sibling/children/grandchildren strings, “marriage details”, etc)
* `Siblings & Children`, `Grandchildren`, and the women/children lists (good for cross-checking, preferred names, etc)

---

## 5) App UX / IA (routes)

### Public

* `/login` (magic link)

### Authenticated

* `/` Dashboard

  * birthday today + next upcoming
  * quick search
  * import status + last changes
  * data-quality tiles (missing DOB/DOD, missing parents, etc)
* `/people`

  * searchable directory + filters + saved views
* `/people/[id]`

  * profile (photos, key facts, relationships, tags, notes, sources/attachments)
  * timeline section
* `/tree`

  * **Focus tree** (interactive expand/collapse)
  * toggle: “Full tree mode” (heavy view with virtualisation)
* `/timeline`

  * chronological events feed, filterable
* `/stats`

  * full analyst module (see below)
* `/admin/imports`

  * upload workbook, preview diff, run import, view issues
* `/admin/data-quality`

  * missing-data flags, duplicate flags, conflict flags
* `/admin/settings`

  * invite users, roles

---

## 6) Stats module (deep + fast)

### Core UX

* Left sidebar: filters (branch/root person, generation, sex, living/deceased, birthplace/residency, tags, time ranges)
* Main area: tiles + charts
* Everything cross-filters (click a bar/segment to filter)

### “Analyst” views (v1)

* Population

  * total people; living count; births by decade; deaths by decade
* Longevity

  * lifespan distribution; median lifespan by generation; outliers
* Names

  * top first names by decade; surname variants frequency
* Family structure

  * children-per-person distribution (where inferable); age-at-death by branch
* Data completeness

  * % missing DOB; % missing DOD; missing parents; missing sex; missing spouse
* Birthday analytics

  * month heatmap; “birthday clusters”; upcoming birthdays by branch
* Geographic (v1-lite)

  * “countries lived in” counts and trends (map later)

Performance notes:

* Create materialised views / cached aggregates for heavy charts.
* Use Postgres trigram search for names + full-text for bios/notes.

---

# Comprehensive data model (Neon Postgres)

This is split into **raw import storage** and **canonical entities**.

## 1) Raw import storage (preserve everything)

### `source_file`

Stores the uploaded workbook.

* `id` uuid pk
* `original_filename` text
* `sha256` text unique
* `uploaded_by_user_id` uuid null
* `uploaded_at` timestamptz
* `blob_url` text (Vercel Blob) ([Vercel][3])

### `import_run`

One execution of parsing + upserting.

* `id` uuid pk
* `source_file_id` uuid fk
* `status` enum(`queued`,`running`,`completed`,`failed`)
* `started_at`, `finished_at` timestamptz
* `summary` jsonb (counts, timings)
* `app_version` text (so you know which importer code ran)

### `import_sheet`

* `id` uuid pk
* `import_run_id` uuid fk
* `sheet_name` text
* `row_count` int

### `import_row`

Stores every row from every sheet as JSONB (this is the “never lose anything” layer).

* `id` uuid pk
* `import_sheet_id` uuid fk
* `row_index` int (0-based or 1-based; choose and stick to it)
* `row_json` jsonb (all columns)
* `row_hash` text (hash of canonicalised JSON for diffing)
* `is_blank` bool

### `import_entity_link`

Connects raw rows to canonical entities (many-to-many).

* `id` uuid pk
* `import_row_id` uuid fk
* `entity_type` enum(`person`,`event`,`relationship`,`place`,`media`,`tag`,`note`,`contact`)
* `entity_id` uuid
* `reason` text (e.g. “primary_row”, “filled_missing_dob”, “validation_reference”)

### `import_issue`

Flagging only (missing data, conflicts, duplicates).

* `id` uuid pk
* `import_run_id` uuid fk
* `severity` enum(`info`,`warning`,`error`)
* `code` text (e.g. `MISSING_DOB`, `PARENT_AFTER_CHILD`, `DUPLICATE_NAME_DOB`)
* `message` text
* `sheet_name` text null
* `row_index` int null
* `entity_type` text null
* `entity_id` uuid null
* `meta` jsonb (details, candidate matches, etc)

This layer is what makes “everything from Excel” non-negotiably true.

---

## 2) Canonical entities

### A) Identity + people

#### `person`

Represents any individual: Loyd core IDs, girls/descendants alphanumeric IDs, spouses/partners placeholders.

* `id` uuid pk
* `created_at`, `updated_at` timestamptz
* `is_placeholder` bool default false (for spouses inferred from text)
* `primary_external_key` text unique (e.g. `LOYD:12`, `GIRLS:2a`, `SPOUSE:LOYD:3:1`)
* `source_system` text (e.g. `LOYD_BOOK_2022`)
* `external_id` text (raw: `12`, `2a`, `-1`)
* `branch_root_external_id` text null (optional: quick grouping)
* `gender` enum(`male`,`female`,`unknown`)  (map Boy/Girl/Male/Female)
* `surname` text null
* `given_name_1` text null
* `given_name_2` text null
* `given_name_3` text null
* `known_as` text null
* `birth_name` text null
* `preferred_name` text null
* `display_name` text (generated/stored for fast UI)
* `dsp_flag` bool null (from “DSP?”)
* `residency_text` text null (raw “countries lived in” string)
* `biography_md` text null (markdown)
* `biography_short_md` text null
* `notes_md` text null (optional “sticky” notes at person-level, separate from note objects)
* `expected_photo_count` int null (from photo sheet)
* `legacy_generation` int null (from core list)
* `generation_from_william` int null (from girls sheet)
* `descendant_generation` text/int null (store as text if non-numeric)
* `length_metric` text null (your “Length” column; often numeric but store raw-safe)
* `raw_name_string` text null (e.g. “William (1): 1729–1800”)

Indexes

* trigram index on `display_name`, `surname`, `known_as` (pg_trgm) ([Neon][2])
* full-text index on biography + notes (optional)

#### `person_alias`

For alternate names (including “Known as”, maiden names, etc).

* `id` uuid pk
* `person_id` uuid fk
* `label` text (e.g. `known_as`, `maiden`, `nickname`, `preferred`)
* `value` text
* `source` text null

#### `entity_attribute`

Flexible key/value attributes for anything you don’t want hard-coded.

* `id` uuid pk
* `entity_type` enum(`person`,`relationship`,`event`,`place`,`media`)
* `entity_id` uuid
* `key` text (normalised, e.g. `address_2000`, `armed_service`, `issue_details`)
* `value_text` text null
* `value_json` jsonb null
* `source_import_row_id` uuid null

This is how we truthfully ingest “Issue Details / Armed Service / random sheet fields” without schema churn.

---

### B) Events (birth/death/marriage/etc)

#### `event`

* `id` uuid pk
* `type` enum(`birth`,`death`,`marriage`,`residence`,`other`)
* `title` text null (optional)
* `description_md` text null
* **Date fields (support exact + partial + textual)**

  * `date_exact` date null (when you have a real date)
  * `date_year` int null
  * `date_month` int null
  * `date_day` int null
  * `date_text` text null (e.g. `c1690`, `1798/99`, `Unknown`, `?`)
  * `date_is_approx` bool default false
* `place_id` uuid null fk
* `created_at`, `updated_at` timestamptz

#### `person_event`

Join table (many events per person; marriage involves two people via two rows).

* `id` uuid pk
* `person_id` uuid fk
* `event_id` uuid fk
* `role` text null (e.g. `subject`, `spouse`, `child`)
* unique(person_id, event_id, role)

---

### C) Relationships

#### `parent_child`

* `id` uuid pk
* `parent_id` uuid fk person
* `child_id` uuid fk person
* `type` enum(`biological`,`step`,`adoptive`,`unknown`) default `unknown`
* `notes_md` text null
* unique(parent_id, child_id)

#### `partnership`

Used for spouse/partner relationships, including those extracted from text.

* `id` uuid pk
* `person_a_id` uuid fk
* `person_b_id` uuid fk
* `type` enum(`marriage`,`partner`,`unknown`) default `unknown`
* `start_event_id` uuid null fk (marriage event)
* `end_event_id` uuid null fk
* `notes_md` text null (e.g. “(1) … (2) …”)
* unique(person_a_id, person_b_id) with ordering normalised (store min/max id to avoid duplicates)

> Because spouses in Excel are often free-text, we create placeholder people where needed and **flag** if we later detect likely duplicates (but do not auto-merge).

---

### D) Media (photos + attachments)

#### `media`

* `id` uuid pk
* `type` enum(`photo`,`document`,`other`)
* `blob_url` text
* `blob_key` text
* `mime_type` text
* `file_size` int
* `width` int null
* `height` int null
* `caption` text null
* `taken_date_exact` date null
* `taken_date_text` text null
* `created_by_user_id` uuid null
* `created_at` timestamptz

#### `media_link`

Attach media to people/events.

* `id` uuid pk
* `media_id` uuid fk
* `entity_type` enum(`person`,`event`)
* `entity_id` uuid
* `is_primary` bool default false (profile photo)
* `sort_order` int default 0

---

### E) Notes (markdown + TipTap editing)

#### `note`

* `id` uuid pk
* `entity_type` enum(`person`,`event`,`relationship`,`place`)
* `entity_id` uuid
* `title` text null
* `markdown` text (canonical)
* `tiptap_json` jsonb null (optional cache for editor fidelity)
* `created_by_user_id` uuid
* `created_at`, `updated_at` timestamptz

(Use TipTap in the UI; store markdown as requested; optionally store JSON snapshot for stable editing.)

---

### F) Tags + saved views

#### `tag`

* `id` uuid pk
* `name` text unique
* `colour` text null (optional)

#### `tag_link`

* `id` uuid pk
* `tag_id` uuid fk
* `entity_type` enum(`person`,`event`,`relationship`,`media`,`note`)
* `entity_id` uuid
* unique(tag_id, entity_type, entity_id)

#### `saved_view`

Saved filters for directory/stats.

* `id` uuid pk
* `user_id` uuid fk
* `name` text
* `scope` enum(`people`,`stats`,`tree`,`timeline`)
* `filter_json` jsonb (your filter model)
* `created_at` timestamptz

---

### G) Contacts (no privacy v1, but isolated for future)

#### `contact`

* `id` uuid pk
* `person_id` uuid fk unique
* `emails` text[] (split on `;`)
* `mobile` text null
* `landline` text null
* `address_2000` text null
* `postal_address_2021` text null
* `establishing_contact` text null
* `comments` text null
* `age_current_excel` int null
* `number_of_kids_2000` int null

---

### H) Activity / change feed

#### `activity`

* `id` uuid pk
* `type` enum(`import_run`,`note_created`,`media_added`,`tag_added`,`entity_updated`)
* `actor_user_id` uuid null (imports may be system)
* `entity_type` text null
* `entity_id` uuid null
* `message` text
* `meta` jsonb
* `created_at` timestamptz

---

### I) Places (future-ready: houses + map)

#### `place`

* `id` uuid pk
* `type` enum(`country`,`region`,`city`,`address`,`house`,`cemetery`,`other`)
* `name` text
* `address` text null
* `country` text null
* `lat` double precision null
* `lng` double precision null
* `source_text` text null

#### `person_place`

For later residence/house tracking (works now with “countries lived in” as place rows).

* `id` uuid pk
* `person_id` uuid fk
* `place_id` uuid fk
* `from_event_id` uuid null
* `to_event_id` uuid null
* `notes_md` text null

---

## 3) Mapping: workbook → canonical (sheet-by-sheet)

### `Loyd List 1-190 - Edit`

Map (examples):

* `Loyd ##` / `Loyd #.1` → `person.external_id` (numeric), `primary_external_key = LOYD:<id>`
* `Surname`, `1st/2nd/3rd Name`, `Known as` → name fields
* `Sex` → `gender`
* `Year of Birth`, `Year of Death` → create/update birth/death events (year fields)
* `Dob Entered` → birth event `date_exact`
* `DoD` → death event `date_exact` (if present)
* `DoM` → marriage event (stored as `event` and linked later when spouse exists)
* `Father's Loyd #`, `Mothers' Loyd #` → `parent_child` edges (if referenced person exists)
* `BIRTH MONTH`, `BIRTH DAY`, `DEATH MONTH`, `DEATH DAY` → fill partial date fields when exact date missing
* `FINAL AGE`, `AGE IF LIVING` → store as attributes (and compute real age in views)

### `All Girls & Descendants`

* `Loyd ##` (e.g. `2a`) → `person.external_id`, `primary_external_key = GIRLS:<id>`
* `Loyd #` (mother Loyd id) → create `parent_child` edge (mother → child)
* `Father's Loyd Loyd #` and `PARENT's Loyd #` → store as attributes (and validation references)
* `Dob Entered`, `DoD`, `DoM` → events
* `Male/Female` → gender
* `Husband/WIFE/Partner` → create placeholder spouse person + partnership edge (flag duplicates only)
* `Marriage Notes`, `Additional Information*` → markdown notes/attributes linked back to import rows
* Ignore pivot-style `Unnamed:*` totals for canonical, but keep raw rows regardless

### `Updated Bios & Spouse Details` / `BiographyMarriageDetsCountries`

* Bio fields → `biography_md` and/or a “bio note”
* `Countries lived in` → `residency_text` plus optionally generate `place` rows of type `country`
* `WIFE/HUSBAND`, `Marriage Notes` → partnership notes, placeholder spouse creation (flag-only duplicates)

### `Hatch&Match Details`

* Ingest person `-1` (Thomas) and any missing fields; treat as a supplement source.
* Use `B'DAY / B'MONTH / B'YEAR` style columns to fill partial dates when missing elsewhere.
* Everything else becomes attributes (excellent for later QA reports).

### `Contacts`

* Map into `contact` table (split emails by `;`).
* Link to `person` via external id (Loyd ##).
* Keep raw row + attribute fallbacks.

### `Generations&Photos- CostsAT1`

* Map `Loyd #` → `expected_photo_count` (values behave like counts: 1/2/4).
* Other cost/print columns: store as raw + optional attributes (not needed for genealogy UI, but preserved).

### Derived/validation sheets (`Book Details - NO EDIT`, `Siblings & Children`, etc)

* Store raw rows (always).
* Extract useful flags into attributes where present (e.g. `DSP?`).
* Use sibling/children string lists only for **validation warnings** (“Excel says 6 children but we linked 5”).

---

# Importer design (idempotent + diff + flags)

## Steps

1. Upload workbook → store in Blob → create `source_file` + `import_run`.
2. Parse all sheets → write `import_sheet` + `import_row`.
3. Canonical pass:

   * Upsert persons by `primary_external_key`.
   * Upsert events (birth/death) deterministically.
   * Create/refresh relationships:

     * parent-child from numeric references
     * spouse placeholder relationships from text
4. Validation pass (flags only):

   * Missing DOB/DOD
   * Parent younger than child (date sanity)
   * Duplicate candidates (name + close year + shared relations)
   * Conflicting DOB across sheets
5. Produce import diff summary + append `activity` items:

   * “12 people updated, 3 added, 7 warnings”

---

# Resend + auth implementation note

Use Auth.js/NextAuth with the **Resend provider** for magic links ([authjs.dev][1]), plus invite-only onboarding (admin creates an invite; user receives link; first login creates account).

---

If you want, the next step is for me to convert this into:

* a **migration-ready SQL DDL** (or Prisma schema) that matches the model above exactly, and
* a **detailed importer spec** with deterministic precedence rules (which sheet wins when DOB differs), plus test cases based on your workbook’s quirks.

[1]: https://authjs.dev/getting-started/providers/resend?utm_source=chatgpt.com "Resend"
[2]: https://neon.com/docs/extensions/pg_trgm?utm_source=chatgpt.com "The pg_trgm extension - Neon Docs"
[3]: https://vercel.com/docs/vercel-blob?utm_source=chatgpt.com "Vercel Blob"
