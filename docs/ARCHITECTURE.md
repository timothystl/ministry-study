# Architecture

Ministry Study is a personal ministry workspace for Andrew (library, sermons, prayers, notes,
hymns and liturgies, images and clips, Bible study) that a few other people can use with libraries
of their own. It is one of the Timothy apps; the app family and central architecture are in
[digital-architecture](https://github.com/timothystl/digital-architecture). This repository is
self-contained and has no service binding to the other apps.

## Runtime

- Front end: React, TypeScript, Vite, plain CSS, Lucide icons, Zod for import validation
  (`src/`). Built to `dist/`.
- Worker: `worker/index.ts` serves `dist/` as static assets (single-page-app fallback) and runs
  first for `/api/*` (`wrangler.jsonc`). Worker name `ministry-study`, served at
  `study.timothystl.org`.
- Database: Cloudflare D1 `timothy-study-db`, bound as `DB`. The Worker creates its tables on first
  use. There is no R2 binding.
- Observability: Workers Logs are enabled in `wrangler.jsonc`. Never log catalog, sermon, note or
  prayer content.
- Offline cache: each browser keeps a local copy in `localStorage` and retries saves when the
  connection returns. Running with no shared server (plain `npm run dev`) works with everything
  on and nothing shared.

## Shared library database

Each catalog item is one row in `records` (`kind`, `id`, `data` JSON, `updated_at`, `owner`), so a
save sends only what changed and new kinds need no schema change. Kinds: `book`, `series`, `loan`,
`sermon`, `prayer`, `prayerset`, `note`, `ideasource`, `visual`, `hymn`, `liturgy`, `resource`.
The JSON is the same validated shape as the backup file; a library rebuilt from rows is validated
before it replaces the local copy. Illustrative `sample-` books are never saved.

A per-owner revision counter (`meta`) refuses a save made from an out-of-date copy; the device is
asked to choose instead. Deletes are real deletes; recovery is D1 point-in-time recovery plus
exported backups.

Other tables: `people` (access list), `sermon_text` and `sermon_fts` (manuscript text and its FTS5
index, kept apart from the library payload), `attachment` and `attachment_piece` (stored files in
base64 pieces, reference-counted across records). Record shapes are in
[data-model.md](data-model.md).

Sync code: `src/lib/sync.ts`, `src/lib/useSync.ts`, `src/components/SyncBanner.tsx`. Storage code:
`worker/store.ts`, `worker/attachments.ts`, `worker/sermonText.ts`, `worker/usage.ts`.

## API

All routes require a verified Cloudflare Access sign-in (see Security).

| Route | Purpose |
| --- | --- |
| `GET /api/library`, `POST /api/changes` | Library rows and saving changes |
| `GET /api/me`, `/api/people` | Signed-in person, their parts; People administration (administrator only) |
| `/api/sermon-text`, `/api/sermon-text/:id`, `/api/sermon-search`, `/api/sermon-export` | Manuscript text, search, export |
| `/api/attachments/:id` | Store (PUT), read (GET), remove (DELETE) a file |
| `GET /api/usage` | Storage used by the signed-in person's library |
| `GET /api/esv`, `/api/net`, `/api/biblia/*`, `/api/yvp/*` | Bible text proxies; keys stay on the server |
| `GET /api/lcms-prayer` | Reads the LCMS weekly prayer Word file for a date |

Bible texts for Hebrew, Greek, LEB and the word studies ship with the site under `public/data/`
and are built by the `scripts/build*.mjs` scripts from checkouts of STEPBible-Data, SBLGNT and
the LEB USFM source (usage is in [FEATURES.md](FEATURES.md)).

## People and permissions

`STUDY_ADMIN_EMAIL` identifies the administrator (Andrew), who always has every part. Anyone else
is added on the People page, is given parts to use (`worker/sections.ts`: library, sermons, prayers,
notes, visuals, ideas, bible, children, hymns), and also needs their email in the Cloudflare Access
policy. Each person has a separate library (`owner` on `records` and the manuscript tables; the
administrator's owner is `admin`). The administrator cannot read other libraries. The server checks
the part for every record kind on every read and write; hiding a menu item is never the only lock.
Turning a part off hides and blocks but does not delete. Access can be paused, never deleted. The
attachment routes are open to anyone with the Hymns or Sermons part on.

## Security and privacy

- `worker/access.ts` verifies the Access token (`STUDY_ACCESS_TEAM_DOMAIN`, `STUDY_ACCESS_AUD`).
  `STUDY_DEV_NO_AUTH=1` bypasses it for local development only (ignored `.dev.vars`).
- If `STUDY_ADMIN_EMAIL` is unset the API answers 503 to everyone.
- The repository is public. Personal catalogs, backups, sermon files, prayers and family names
  never go in `src/`, `public/`, fixtures or docs; use ignored `private/` and `*.backup.json`.
  Tests use invented data.
- Funeral and wedding sermons are kept out of search and out of review packages by default.
- Attachment content is sniffed, not trusted by name, and served with `nosniff` and `sandbox`.
- Secret and variable names are listed in [OPERATIONS.md](OPERATIONS.md); never write values.
