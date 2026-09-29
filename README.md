# Ministry Study

**Continuing on another computer? Start with [HANDOFF.md](HANDOFF.md).**

A working home for sermons, Bible studies, hymnody, library, and other resources.

The first release starts with a calm personal library for books, reading, and the ideas worth returning to.

**v0.1 is the responsive application shell and Library only.** Research a Text, Scripture and pattern tools, hymns/music, sermons, teaching resources, and other broader modules are explicitly deferred. There are no nonfunctional navigation placeholders for them.

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

## Covers and physical verification

Open a book and choose **Find cover**, then search Open Library by ISBN or title/author. Preview a candidate and choose **Use this cover**. Only the cover URL and attribution are saved; catalog details remain unchanged. ISBN lookup uses the edition endpoint; title results group works and may show a different edition. Missing images and service failures are handled without replacing the current cover. Edit book also supports online cover selection and a pasted HTTPS image URL. Images remain hosted by their source rather than being copied into local storage.

Choose **Verify physical book** to compare title/author, edition/volume/ISBN and shelf location against the actual copy. Save **Confirmed** after checking all three boxes, or **Needs correction** with separate verification notes. **Correct book details** opens the editor, including an editable edition field. Original imported confidence and review details are retained as provenance. Changing identity or current location resets a confirmation to **Not checked**; cover, notes and reading changes do not. The catalog’s verification filter includes **To check**, and **Next to check** advances through physical shelf order.

Older backups load as Not checked. New backups retain verification and cover provenance. Open Library receives only the search fields; remote cover hosts receive image requests. These features do not add cloud syncing or automatically enrich/confirm the library.

## ISBN lookup

Open a book → **Find ISBN** → **Find matching books** → choose a title → compare its editions. Edition records show publisher, publication date, format, edition and language where supplied. Choose an ISBN and check **I checked this edition against my book** before saving. Existing ISBN replacement is explicit. Only the ISBN and lookup provenance change; other bibliography, covers, locations and personal notes are retained. Missing/invalid ISBNs are not guessed, and editions without identifiers remain visible. Pagination retrieves 20 editions at a time. Manual ISBN entry remains available in Edit book. This is a reviewed per-book lookup, not automatic bulk enrichment.

## Shared library database

The app can save to a free Cloudflare D1 database, following the same pattern as the other Timothy apps (Worker + D1 + Cloudflare Access). Each catalog item is one row (`kind` + `id` + JSON), so a save sends only what changed, and the same table will hold sermons, children's messages, hymns and other kinds later. A revision number stops a device with an out-of-date copy from overwriting newer work; it is asked to choose instead. This browser's copy remains a working offline cache and saves are retried when the connection returns.

- `worker/`: the API (`GET /api/library`, `POST /api/changes`), D1 storage, and Cloudflare Access token verification. Tables are created on first use.
- `src/lib/sync.ts`, `src/lib/useSync.ts`, `src/components/SyncBanner.tsx`: change detection, start-up decision, and the banner.
- `wrangler.jsonc`: Worker, static assets, and the `DB` binding.

**One-time setup on Cloudflare** (the app keeps working locally, and the API refuses all requests, until this is done):

1. Make sure the `name` in `wrangler.jsonc` matches the existing Cloudflare project for study.timothystl.org.
2. In Zero Trust → Access → Applications, protect `study.timothystl.org` (self-hosted; policy limited to the people who should see the library). The site is otherwise public and the repository is public.
3. In the project's Settings → Variables, set `STUDY_ACCESS_TEAM_DOMAIN` (the `…cloudflareaccess.com` team domain) and `STUDY_ACCESS_AUD` (the Access application's audience tag).
4. Deploy. The D1 database `timothy-study-db` is created automatically on first deploy.

The first device to open the app after that is offered **Save this library to the shared library**; later devices adopt it. D1 keeps 30 days of point-in-time recovery; **Export backup** remains the private off-Cloudflare copy. Local runs use `npx wrangler dev` with `STUDY_DEV_NO_AUTH=1` in an ignored `.dev.vars`. Free-tier limits (5 GB, 100,000 writes a day) are far above this use.
