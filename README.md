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
3. In the project's Settings → Variables, set `STUDY_ACCESS_TEAM_DOMAIN` (the `…cloudflareaccess.com` team domain), `STUDY_ACCESS_AUD` (the Access application's audience tag) and `STUDY_ADMIN_EMAIL` (the pastor's sign-in address; without it the API refuses everyone, so set it before deploying).
4. Deploy. The D1 database `timothy-study-db` was created in the dashboard and is referenced by ID in `wrangler.jsonc`; the worker creates its tables on first use.

The first device to open the app after that is offered **Save this library to the shared library**; later devices adopt it. D1 keeps 30 days of point-in-time recovery; **Export backup** remains the private off-Cloudflare copy. Local runs use `npx wrangler dev` with `STUDY_DEV_NO_AUTH=1` in an ignored `.dev.vars`. Free-tier limits (5 GB, 100,000 writes a day) are far above this use.

### People and permissions

The pastor (`STUDY_ADMIN_EMAIL`) is the administrator and always has every part of the study. **People** (in the menu, administrator only) adds other people, each with a **library of their own**: the same catalog kinds, kept as separate rows in the shared database (`records` and the manuscript tables carry an `owner`; the pastor's is `admin`). The administrator does not see their library and they do not see the administrator's.

- **Parts to turn on or off:** Library (books, series, loans, wishlist, scanning), Sermons (catalog, manuscripts, review), Prayers, Devotions & Notes, Children's Messages, Hymns & Liturgies (the hymn catalog, liturgies and attached files). The choice is saved as soon as a box is ticked. Each part owns certain record kinds (`worker/sections.ts`), and the server checks that on every read and write, so hiding a menu item is never the only lock. Turning a part off hides what the person saved there and blocks saving more; it does not delete it, and turning it back on brings it back.
- **Pause access** stops someone signing in to the study while keeping their library; **Restore access** undoes it. There is no delete-a-person button, so nothing can be lost by a misclick.
- A new person starts with an empty library (no illustrative samples). Their browser keeps its own local copy under separate keys, so two people sharing one browser never see each other's.
- **Two steps to let someone in:** add them on the People page, and add their email to the Access policy for study.timothystl.org in Cloudflare. Someone signed in but not added (or paused) sees a short message asking them to contact Andrew.
- Upgrade: the first request after this change moves every existing row and manuscript to the pastor's library and rebuilds the manuscript search index from the saved text; nothing has to be done by hand, and the pastor's revision counter carries over unchanged.
- Running locally with no shared server, everything is on and nothing is shared, as before.

## Sermons

**Sermons** (in the menu) is a catalog of what has been preached and where each manuscript lives. A record holds title, passage, date, series, occasion, church season, themes, summary, notes, and manuscript and recording locations (a OneDrive or web link, or a file path). Files stay where they are; a web address opens, and a file path can be copied.

- **Passage search.** Search "Luke 15", "1 Cor 13:4", or "Ps 23" and every sermon whose passage overlaps is found, newest first. A record's page also lists other sermons on the same passage. Other searches match words across every field. Each result says why it matched, and search covers what is recorded, not manuscript text.
- **Import sermon information** (three tabs). _Sermon list_ reads a CSV index (Title; optional Scripture, Date, Series, Occasion, Path, Liturgical Season, Liturgical Sunday, Lectionary Year) or pasted file names, using only a leading date and a written passage. Filing styles such as `Matt 13.24-30`, `Matt 18v1-6,19v13-15` and `Isa 42.1-7` are read and rewritten one way; anything unreadable is left blank and reported. _Text history_ (.md) fills opening, closing, central image and gospel statement, and a passage where the index had none. _Structure review_ (.xlsx or CSV) fills structure, category and rationale, marked as an AI review. The overlays match by the number at the start of the file name (the suggested-name number when the index has one) and fill only empty fields; nothing typed by hand is replaced. Every import shows a preview first.
- Sermons are saved and shared like the rest of the library. A library too large for the browser's own copy keeps saving to the shared database and says so.

Personal archive files are imported through the app and are never committed. Tests use invented entries in the same shapes.

### Sermon manuscripts (full text)

**Sermons → Manuscripts** saves the full text of sermons in the shared database, apart from the library so the library stays quick. Choose a folder or files (Word .docx, .txt or .md). Files are read in the browser and only their text is sent; your originals are not changed. Each file is matched to a sermon by its recorded file name (or by file number when the title agrees); a review shows new, changed, unchanged, unmatched and unreadable files before anything is saved, and unmatched files can optionally get sermon records. Re-choosing the same folder saves only what changed.

- **Search** also covers the saved words: whole words with stemming (returning finds returned), "quoted phrases", and a highlighted excerpt on each result. A sermon can be kept out of search (for funerals and other private pastoral material) while its text is still saved.
- A sermon's page shows its manuscript, with copy, replace, remove, and an Include in search switch.
- **Download all manuscripts** makes a zip of plain text files as a backup that lives outside Cloudflare. Keep it private.
- Needs the shared library (sign-in); without it the section says so. The text is stored in D1 tables `sermon_text` (the backup copy) and `sermon_fts` (an FTS5 index), created on first use.

### Reviewing and correcting the catalog

**Sermons → Review** is for improving titles, passages, themes, summaries and structures with an outside reader, such as Claude Cowork reading the manuscripts.

1. **Download review package** makes a zip with `catalog.csv` (one row per sermon, with each sermon's ID and what the catalog says now), `manuscripts/` (each saved manuscript, named in the catalog's Text File column), `structures.txt` (the structure names already in use), and `README.md`, the instructions for the reader. The instructions say exactly what to return: a `review.csv` with a Sermon ID, blank cells where there is nothing to propose, a Confidence and a short Evidence sentence, and rules (use only what is in the manuscript, never invent a date or passage, keep Andrew's voice for titles, do not copy personal details from funerals and weddings). **Catalog only (CSV)** downloads just the spreadsheet. Without the shared library the package has the catalog and instructions only.
2. **Choose review.csv** shows every proposed change beside what is there now. Additions to empty fields start approved; replacing something already filled in starts unapproved. Approve one change, one sermon, all additions, or everything, then apply. Passages are rewritten one way and unreadable passages or dates are skipped with a warning. A replaced title is kept as a "former title", and the reviewer's confidence and evidence are kept on the sermon. Nothing changes until approved.

The instructions live in `src/lib/reviewBrief.ts`.

## Prayers

**Prayers** (in the menu) has three parts. Everything is saved and shared like the rest of the library.

- **Library.** Biddings, sermon-theme starters, prayers and devotions, searchable by words, category and type, with add, edit, copy and remove. **Import prayers** reads the Prayers of the Church builder file (its `LIBRARY` and `STARTERS`), or the same data as JSON, shows a preview, and skips prayers already there. A bidding is stored without its closing "Lord, in your mercy," (the builder adds it once). Write `[names]` where names should go.
- **Build the Prayers of the Church.** Enter the Sunday or occasion, date and text (or pick a sermon to fill the text), names of the sick, the grieving and birthdays, then choose one bidding per category. Names replace `[names]` in those three categories. Add other concerns and a sermon-tied petition (optionally started from a sermon-theme starter). A live preview shows the whole service; **Copy all** or **Download** it as text.
  - **Timothy's prayers.** **Load Timothy's prayers** (Library tab, or the empty Build tab) adds the pastor's own prayer library from `public/data/timothy-prayers.json`: 16 categories with 93 biddings (the sick, the grieving, mental health, loneliness, financial hardship, families, neighborhood, government, school, the dying, the homebound, birthdays, mission, the wandering, addiction, and the Every Moment Holy lyrical petitions) and ten sermon-theme starters. It replaces the small starter set, skips anything already loaded, and can be pressed again safely. **Prayer Writer** is the AI drafting page from the original prayer writer, kept outside this app on claude.ai (an Artifact that asks Claude through the pastor's own Claude account, so there is no key and no cost here). It writes biddings in the Timothy voice, lets you edit and keep them, and saves a `drafted-prayers.json` file that **Import prayers** reads (biddings land in their category; sermon petitions become sermon starters). The Library toolbar links to it.
  - **Starter biddings.** With an empty library, **Load starter biddings** adds a ready set (church, world, nation, need, sick, grieving, birthdays, thanksgiving), and **Choose the first bidding in every category** fills a whole service in one click. Names typed in are prayed for even if no bidding is chosen. The date starts at the coming Sunday.
  - **LCMS weekly prayer.** The LCMS posts each Sunday's Prayers of the Church, free to use, as Word files. **Get this Sunday's LCMS prayer** reads the file for the chosen date (Three-Year or One-Year Series) through the server (`/api/lcms-prayer`, which reads the .doc text itself), offers the Responsive or Ektene form (and both days when a festival shares the date), and puts it in an editable box. It goes into the service under its own heading, exactly as the LCMS wrote it (it carries its own responses), with the names of the sick filled into the LCMS's `[especially ____]` blank. The blanks for the district president, pastor and so on are left for you to fill. Links to the LCMS pages and a paste box remain for when the LCMS site is unreachable.
  - **Export and email.** **Copy all**, **Download** (text), **Print or save as PDF**, and **Email these prayers** (opens your mail program; the address is remembered; if the prayers are too long for a link, they are copied for you to paste).
- **Saved services.** **Save this service** keeps the built text. Names are left out of the saved copy unless you tick Keep the names, since they are private pastoral information. Open a saved service to reuse it.

The prayer texts are personal content and are never committed; tests use invented prayers in the same shape. Drafting new biddings with an AI model (as the original builder did) is not part of the app.

### Funerals, weddings and ordinations

Occasional services are cataloged as sermons, with an Occasion and a **For** field (whom the service was for; searchable). A **Kind of service** filter shows Funeral & memorial, Wedding, or Ordination & installation. The kind is recognized from the record's own occasion, title, series and For fields (words like funeral, memorial, committal, wedding, ordination, installation), never from the manuscript, so a sermon that only mentions a funeral is not one; a regular sermon whose title uses one of those words would be, and setting its occasion does not change that. Import a list with a CSV (Title, Occasion, Subject, Date, Path and the usual columns).

Funerals and weddings name real families, so they are private by default: their manuscripts are saved but **kept out of search** unless you tick the box in Manuscripts, and they are **left out of the review package** unless you tick Include funeral and wedding sermons. Ordinations and installations are treated like any other sermon.

## Devotions & Notes

A page for council and midweek devotions, sermon-preparation notes and study notes. Each note has a kind, an optional passage and date, tags, and an optional link to a sermon.
Search matches words, or a passage by chapter and verse. A sermon's page lists its linked notes and
other notes on the same passage, with "Add a note" pre-linked to that sermon. "Import" turns a
folder of text or Word files into notes (already-imported files are skipped; anything over 30,000
characters belongs in Sermons → Manuscripts). Notes sync to the shared library like other records.

### Scanning when adding or updating a book

Add Book has "Scan the barcode to fill this in" (title, author, publisher, year, ISBN, cover and
summary; you review before saving). An open book has "Scan barcode", which saves the ISBN. The
author, publisher, year and subtitle from the scan replace what was recorded; the cover and summary are added only if the book has none. The camera can be replaced by typing the ISBN.

## Illustrations & Ideas

The collector: its own page for stories, quotes, illustrations, facts, half-ideas and photographed
scraps. Built for capture first: type an idea in one line and press Enter, or use "Photograph a
scrap" for handwritten notes and index cards (sort them later). Each item can record where it came
from (a book and page, a link, a person), be marked Personal (about real people), and carry photos.
"Mark as used" keeps a history of where it was used, and the Use filter shows what is still unused.
Search reads the words, the source, the use history and passages by chapter and verse. It uses the
same records as Devotions & Notes, so it syncs and backs up with them; earlier notes of the
Illustration and Idea kinds appear here instead. It is its own part on People. **Look elsewhere** opens a search of TextWeek, The Salt Project, RW360, Cardiphonia, Working Preacher, Christian Century or
Sojourners (limited to that site, for whatever is in the search box, such as a passage) in a new tab. "Add a site" adds your own
(kept in the shared library; remove it with the bin). **Take a photo** opens the phone's camera and saves the picture as a Scrap at
once; add a caption afterward. **Paste links** (or paste one link into the quick-add line) saves each
link as an item titled from the link, with an optional note after a "|"; only the link and your note are kept, not the page's
text. Photos here are for reference, so they are made small (about 1 MB at most, 1,400 pixels on the long side); when a better
image exists, link it under "Where it came from" instead of storing it. Planned next: the
Visual Collector (images and clip links), see docs/collectors-scope.md.

**Storage used** (Library Data → Check storage) shows what the shared library holds: documents, images, video and
music/audio files with sizes, the text of the catalog and manuscripts, and the ten biggest files with the record each belongs
to, so it is clear where to cut back. It counts the signed-in person's own library only.

## Images & Clips

Its own page for images and video clips kept for reference. Each item records a link (the better copy lives there; the study
keeps at most a small reference photo), who made it, its **license** (Public domain, Creative Commons, CVLI, Own work,
Reference only, or Unknown) with a ready-to-paste credit line, its passage, tags, and what it is for (sermon slide, bulletin,
chapel, Pre-K, website, worship background). Reference-only and Unknown items are marked "Not cleared for display". A clip also
records its start and end, what happens, and a content note. A **YouTube or Vimeo** clip plays in place from its own site (nothing
loads from there until you press play) and opens at its start time. Paste a link into the quick-add line to start a record;
"Look elsewhere" opens searches of Wikimedia Commons, The Met, National Gallery of Art, Library of Congress, Unsplash, Pexels and
YouTube. A sermon's page lists the images and clips on its passage. Uploading clips to Cloudflare R2/Stream is not built yet.
It is its own part on People and its records sync like the others.

## Children's Messages

Its own page for pre-K children's messages and grade school chapel talks (two audiences). They use
the same records as Devotions & Notes, so they sync, back up, search by words or passage, and turn
up on a sermon's page when they share its passage. "Import files" reads a folder of Word or text
files and takes the date and passage from each file name. The side menu now scrolls on small screens.

## Hymns and Liturgies

**Hymns** keeps, for each hymn: title, first line, tune, composer, lyricist, arranger, meter, Bible
references, year, key, hymnal numbers, seasons and parts of the service it is used for, themes,
copyright, and any words you type in (keep only public-domain words or ones you may keep). It also
records where the music is: Finale files, sheet music, slides, recordings (a web address, or a
path in your files) and links to where it is found online. Every hymn has a link that searches
Hymnary.org (Hymnary blocks automated lookups, so it opens in its own tab).
- **RUF Hymnbook**: the ~175 hymns of igracemusic.com/hymnbook are added automatically, once, with
  their credits and links to the lead sheet, overhead lyrics, chord chart and demo. Only titles,
  credits and links are kept.
- **Import list** reads a spreadsheet saved as CSV (Title, First line, Tune, Composer, Lyricist,
  Meter, Scripture, Year, Key, Hymnal, Usage, Themes, Finale, Sheet music, Slides, Link).
- **Attach files** matches a folder of files (Finale, PDF, PowerPoint, audio) to hymns by name.
  With "Store the files themselves" on (the default) each file under 8 MB is uploaded and attached
  to its hymn; larger files, and any you turn it off for, are recorded by location. Files that
  match nothing become new hymns.

**Liturgies** are held as one whole: every part in order, each with its own words, files and music.
- A **Setting** is a complete rite kept to use again (Divine Service, Matins, Evening Prayer); a
  Sunday service, season or occasion is one used on a day. "Start a new service from this" copies a
  liturgy with every part, its words, hymns, files and music, and leaves the date blank.
- Each **part** (hymn, reading, prayer, liturgy text, music, rubric, note) has a name, its words in
  full, files (Finale, slides) and photos or PDFs of its music. The whole service can also have
  slides, an order of service and photos or PDFs.
- The liturgy page shows the **whole service** as one continuous page, with each part's words and
  music together and a hymn's own attached music. "Copy the whole service as text" puts it all on
  the clipboard, and "Print" prints just the service.
- Photos and PDFs stay in the shared library once, however many liturgies use them; a file is
  deleted only when the last record using it is removed.
A hymn's page lists the liturgies that use it. Everything syncs and is included in backups.

### Photos and PDFs on a hymn

Open a hymn and choose "Attach photos or PDFs" (or "Take a photo" on a phone) to keep sheet music,
a scanned hymnal page or a lead sheet with it. Photos over 1.5 MB are shrunk in the browser. PDFs,
Finale (.musx, .mus), PowerPoint, Word and audio files can be attached too, up to 8 MB each. Files are stored in the shared library's database, so they need the shared library
(they are not in the JSON backup download; Cloudflare's own database backups cover them). Only
those kinds are accepted, and the file's contents are checked, not just its name. Finale and
PowerPoint files are kept as downloads.

## Music Resources
A page for the artists, albums, articles, books, songbooks and websites where hymns and songs are
found. Each has a kind, creator, year, place, link, tags and notes, plus copies kept in your own
files and photos or PDFs attached to it. The 466 artists, albums, articles and books from your
Retuned Hymn Movement workbook are added automatically, once, with their links (anything you
enter yourself is untouched, and anything you remove stays removed). "Add resource" is for anything new you start using, such as an
album you downloaded or a songbook you bought. Search covers every field; filter by kind or tag.

### Storing the original sermon files
Sermons → Manuscripts now also stores the original files. Choose the folder of Word files as before;
each file is matched to its sermon, its text is saved for search, and (with "Also store the original
files" on, the default) the file itself is stored and attached to the sermon, where it appears under
"Sermon files". Running it again skips files already stored with the same name and size, and a
changed file replaces its older copy. A sermon's page also has "Attach photos or files" for adding
one by hand. Files up to 8 MB (Word, PDF, text, photos); funeral and wedding sermons are kept out of
search as before, but their original files are stored like the rest.
