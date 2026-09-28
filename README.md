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

Records are stored in **localStorage for this browser and origin**. There is no cloud sync, authentication, server backup, or cross-device persistence. Changing host/port creates a different storage origin; clearing site data removes local records. Export backups regularly and before restoring. Storage failures are surfaced without closing your form. Corrupt saved data is not automatically overwritten, and can be exported for recovery.

The physical spreadsheet is intentionally not imported yet. Its candidate holdings, source IDs, duplicates, review issues, and uncertain locations need a separate reviewed importer. No physical ownership, locations, or recommendations are inferred from Logos metadata.

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

`npm run build` creates `dist/`. No hosting or public deployment is configured in this version. A future backend can replace the persistence boundary without combining ownership, reading, circulation, and location into a single status.

## Project notes

Add new work here as you go. Broader modules remain future work until explicitly scoped.
