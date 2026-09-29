# Ministry Study

**Continuing on another computer? Start with [HANDOFF.md](HANDOFF.md).**

A working home for sermons, Bible studies, hymnody, library, and other resources.

The first release starts with a calm personal library for books, reading, and the ideas worth returning to.

**Library and Sermons are built.** Research a Text, Scripture and pattern tools, hymns/music, teaching resources, and other broader modules are explicitly deferred. There are no nonfunctional navigation placeholders for them.

## Run locally

Use Node.js 24 LTS and npm:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4173
```

Open http://127.0.0.1:4173. The app uses React, TypeScript, Vite, plain CSS, Lucide icons, and Zod for import validation. No server, database account, or paid service is needed.

## What works

- Dashboard with live counts, reading cards, browse shortcuts, and the selected mountain banner / pull quote.
- Unified metadata and notes search across all library records, with format and ownership filters.
- Browse by topic, author, first-class series, or current physical shelf.
- My Collection, Reading (including read-but-not-owned records), Wishlist.
- Wishlist import from CSV (Title; optional Author, ISBN, Series, Notes) or pasted title/author lists. Preview before saving; matching records retain their details and new books start as not owned.
- Amazon wishlist import from a saved HTML page or copied English list-view text, with item selection, source IDs, valid ISBN matching and separate Kindle format. A share link can open Amazon but does not automatically fetch or synchronize a list. Load the entire Amazon list before saving/copying and verify the preview count; unsupported formats remain excluded. Ambiguous matches are skipped for review.
- Add/edit book and detailed views, including series volume, notes, reading dates, rating, and borrowing source.
- Loans for owned physical books, optional due dates, overdue labels, returns, and retained history. Active loans protect ownership/format from inconsistent edits.
- Separate current shelf and optional future recommended placement. A recommendation never moves a book.
- Validated Logos inventory JSON import, resource-ID deduplication, preserved source metadata and license distinctions.
- Versioned JSON backup export and validated restore with a preview before replacing data.
- Desktop sidebar and mobile navigation, native keyboard-accessible forms, tabbed book details, compact reading/loan tables, mobile quick actions and bottom navigation, grid/list views, and incremental result display.

## Your data

The public repository contains illustrative bibliographic samples only. All sample ownership, reading, and shelf details are fictional and labeled in the UI. The six sample books use retrieved edition covers, with source URLs documented in `docs/assets.md`. Imported records without verified covers use a generated generic cover labeled “Cover not yet identified.” The dashboard reproduces the user-supplied Dr. Seuss quote from the selected visual reference.

Use **Library data → Import Logos catalog** to select `logos-library-inventory.json` from the project handoff. Import removes only sample records, keeps manually added records, skips existing Logos resource IDs, and preserves original metadata. Imported reading status is “Not recorded”; no reading history is inferred. Permanent licenses count as owned; temporary licenses remain separate and do not count as owned. Temporary access is a historical catalog fact, not a current availability check.

Personal catalogs belong outside the repository or in ignored `private/`. Never place them in `src/`, `public/`, or tracked fixtures. No catalog or personal notes are uploaded by the app. Google Fonts may be requested for typography; local fallback fonts work if unavailable. Imported Amazon cover URLs request images from Amazon when displayed. Saved HTML is parsed in an inert template and is never mounted as page content.

Records are kept in **localStorage for this browser** and, once the shared database below is switched on, also saved to a Cloudflare D1 database so every device sees the same library. Until then there is no cross-device persistence. Changing host/port creates a different storage origin; clearing site data removes local records. Export backups regularly and before restoring. Storage failures are surfaced without closing your form. Corrupt saved data is not automatically overwritten, and can be exported for recovery.

A private combined restore file has been prepared separately with 1,111 candidate physical holdings and 661 Logos records. Physical records retain their source IDs, locations, duplicate flags and uncertainty in source metadata; they are not yet confirmed shelf holdings. The general physical-spreadsheet importer is still deferred. No physical ownership, locations, or recommendations are inferred from Logos metadata.

## Checks

```sh
npm run check                 # lint, model/import tests, TypeScript, production build
npx playwright install chromium
npm run test:e2e              # desktop and mobile browser workflows
```

GitHub Actions runs the same checks on pushes and pull requests. Browser tests cover add/edit, persistence, reading without ownership, search, series browse, wishlist, loans/returns/history, catalog import, export, responsive overflow, and keyboard dialog dismissal.

## Structure

- `src/lib/model.ts`: data types, search, book/series saves, circulation constraints.
- `src/lib/storage.ts`: schema validation, safe restore, local storage loading, Logos adapter.
- `src/lib/seed.ts`: clearly labeled fictional sample relationships.
- `src/components/`: book cards/detail, editor, loans, import/backup, native modal.
- `src/App.tsx`: responsive Library navigation, views, and persistence boundary.
- `docs/data-model.md`: model decisions and next-step boundaries.

`npm run build` creates `dist/`. The app is hosted on Cloudflare at https://study.timothystl.org, connected to the GitHub repository. A future backend can replace the persistence boundary without combining ownership, reading, circulation, and location into a single status.

## Project notes

Add new work here as you go. Broader modules remain future work until explicitly scoped.

## Finding a book's ISBN, cover and summary

Open a book and choose **Find ISBN and cover** (one step). Enter the ISBN if you know it, or search by title and author, then choose a title and compare each edition's ISBN and cover beside its publisher, date and format. Pick an ISBN, tick **Also use this edition's cover** if you want it, tick that you checked the edition against your book, and save. Optionally **Find a published summary** shows the publisher's or library's description with its source; tick it to save it (a summary you wrote is only replaced if you say so). Only the ISBN, and the cover and summary you tick, change; the rest of the record stays as recorded. Open Library receives only what you type; cover images load from their host.

**Scan a Book** (menu) reads the barcode on a book's back cover with the camera, or takes a typed ISBN. It shows the cover, title, author, publisher and published summary, then: opens the record if that ISBN is already in your library; offers to match it to an existing record with the same title and author (saving the ISBN, and the cover and summary if the record has none, without changing anything else); or adds it as a new owned physical book. The camera is ready for the next book after each one, and a running tally is kept. It uses the phone or computer camera in the browser (over HTTPS), with the browser's built-in reader where available and a small downloaded reader elsewhere; video never leaves the device. Only ISBN barcodes (978/979) are accepted.

**Take a photo of the cover** on a book's page keeps a small JPEG with the record, for books with no online cover. Photos are shrunk to a small size; keep them for books Open Library lacks, since they add to the library's size.

**Verify physical book** compares title and author, edition, volume and ISBN, and shelf location against the copy in hand. Save **Confirmed** after ticking all three, or **Needs correction** with notes. **Correct book details** opens the editor. Original imported confidence is kept as provenance; changing identity or location resets a confirmation to **Not checked**; cover, note and reading changes do not. The catalog's verification filter includes **To check**, and **Next to check** advances through shelf order. Editing the identity of a book is separate from scanning it: a scan records the ISBN but does not mark a copy verified.

## Shared library database

The app can save to a free Cloudflare D1 database, following the same pattern as the other Timothy apps (Worker + D1 + Cloudflare Access). Each catalog item is one row (`kind` + `id` + JSON), so a save sends only what changed, and the same table will hold sermons, children's messages, hymns and other kinds later. A revision number stops a device with an out-of-date copy from overwriting newer work; it is asked to choose instead. This browser's copy remains a working offline cache and saves are retried when the connection returns.

- `worker/`: the API (`GET /api/library`, `POST /api/changes`), D1 storage, and Cloudflare Access token verification. Tables are created on first use.
- `src/lib/sync.ts`, `src/lib/useSync.ts`, `src/components/SyncBanner.tsx`: change detection, start-up decision, and the banner.
- `wrangler.jsonc`: Worker, static assets, and the `DB` binding.

**One-time setup on Cloudflare** (the app keeps working locally, and the API refuses all requests, until this is done):

1. Make sure the `name` in `wrangler.jsonc` matches the existing Cloudflare project for study.timothystl.org.
2. In Zero Trust → Access → Applications, protect `study.timothystl.org` (self-hosted; policy limited to the people who should see the library). The site is otherwise public and the repository is public.
3. In the project's Settings → Variables, set `STUDY_ACCESS_TEAM_DOMAIN` (the `…cloudflareaccess.com` team domain) and `STUDY_ACCESS_AUD` (the Access application's audience tag).
4. Deploy. The D1 database `timothy-study-db` was created in the dashboard and is referenced by ID in `wrangler.jsonc`; the worker creates its tables on first use.

The first device to open the app after that is offered **Save this library to the shared library**; later devices adopt it. D1 keeps 30 days of point-in-time recovery; **Export backup** remains the private off-Cloudflare copy. Local runs use `npx wrangler dev` with `STUDY_DEV_NO_AUTH=1` in an ignored `.dev.vars`. Free-tier limits (5 GB, 100,000 writes a day) are far above this use.

## Sermons

**Sermons** (in the menu) is a catalog of what has been preached and where each manuscript lives. A record holds title, passage, date, series, occasion, church season, themes, summary, notes, and manuscript and recording locations (a OneDrive or web link, or a file path). Files stay where they are; a web address opens, and a file path can be copied.

- **Passage search.** Search "Luke 15", "1 Cor 13:4", or "Ps 23" and every sermon whose passage overlaps is found, newest first. A record's page also lists other sermons on the same passage. Other searches match words across every field. Each result says why it matched, and search covers what is recorded, not manuscript text.
- **Import sermon information** (three tabs). _Sermon list_ reads a CSV index (Title; optional Scripture, Date, Series, Occasion, Path, Liturgical Season, Liturgical Sunday, Lectionary Year) or pasted file names, using only a leading date and a written passage. Filing styles such as `Matt 13.24-30`, `Matt 18v1-6,19v13-15` and `Isa 42.1-7` are read and rewritten one way; anything unreadable is left blank and reported. _Text history_ (.md) fills opening, closing, central image and gospel statement, and a passage where the index had none. _Structure review_ (.xlsx or CSV) fills structure, category and rationale, marked as an AI review. The overlays match by the number at the start of the file name (the suggested-name number when the index has one) and fill only empty fields; nothing typed by hand is replaced. Every import shows a preview first.
- Sermons are saved and shared like the rest of the library. A library too large for the browser's own copy keeps saving to the shared database and says so.

Personal archive files are imported through the app and are never committed. Tests use invented entries in the same shapes.
