# Data model

Record shapes and rules for the library and the other record kinds. Storage, sync and permissions are in [ARCHITECTURE.md](ARCHITECTURE.md). The library envelope was designed in v0.1 and is still `version: 1`.

The root envelope has `version: 1`, `books`, `series`, `loans`, and a sample-data flag. IDs stay stable on edits and moves. Import/restore validates record shapes, unique IDs, series and loan references, and active-loan consistency before any change is applied.

## Independent concepts

| Concept               | Stored as                                    | Behavior                                                                                                                                            |
| --------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog record        | `Book.id`, bibliography, format, identifiers | A manually added record gets a random stable ID. Logos uses its resource ID. ISBN is not a primary key. Separate copies can remain separate.        |
| Ownership             | `Book.ownership`                             | Owned / Not owned / Previously owned. A book can be read without being owned.                                                                       |
| Wishlist              | `Book.wishlist`                              | Independent of ownership; an already-owned book can remain flagged for review.                                                                      |
| Reading               | `Book.reading`                               | Status, dates, rating, source. “Not recorded” is distinct from “Unread.”                                                                            |
| Circulation           | `Loan[]`                                     | A dated transaction references a book. An empty return date means currently out. Return preserves history. No duplicate active loan.                |
| Current physical home | `Book.location`                              | Room, bookcase, shelf, position; optional and user-entered. An active loan identifies who currently has the copy without destroying its home shelf. |
| Future organization   | `Book.recommendedLocation`                   | Independent optional proposed placement. No automatic relocation.                                                                                   |
| Series                | `Series[]` plus `Book.seriesId` and `volume` | Series is a stable entity reused across records. Removing series from a book does not delete other volumes.                                         |
| Digital access        | `Book.license`                               | Permanent / Temporary / Unknown, kept separate from physical circulation.                                                                           |
| Provenance            | `source`, `sourceId`, `sourceMetadata`       | Original Logos metadata retained verbatim. Raw provenance is not treated as personal notes or indexed as user commentary.                           |

A catalog record currently represents an individually tracked physical copy or digital resource. A future work/edition/holding split can be added while preserving IDs. It is intentionally not an automatic deduplication system. The physical handoff's UUIDs must be retained by its eventual importer, even where several copies share ISBNs/titles.

Search uses all entered terms (case-insensitive AND) across title, author, publisher, identifier, topics, series, volume, current location, summary, and personal notes. It is metadata search, not book-content indexing, semantic search, or Scripture research. Topics imported from Logos are source subject labels, not a newly invented taxonomy. Author groups split semicolon-separated contributors without guessing names.

Borrowed reading sources can be recorded without ownership; outgoing loans are the only circulation workflow in v0.1. There is no incoming-loan transaction/reminder system. Library views can be empty until the user supplies reading, loan, or wishlist information.

## Not built

Research a Text, Scripture pattern tools, external-resource discovery, EPUB/PDF reading, full-text indexing of books, spreadsheet/photo import and reconciliation of the physical library, and automatic organization recommendations. (Sermons, prayers, notes, hymns and liturgies, visuals, Bible Study and cover/ISBN lookup were deferred in v0.1 and are now built; see [FEATURES.md](FEATURES.md).)

## Source review

Implementation was informed by the uploaded consolidated ministry-study handoff, the local project summary/catalog plans, the original conversation's Mockup #1 design description and Option B pull-quote preference, and the physical interface handoff's import contract. The v0.1 build was scoped to the Library. The authoritative visual target is [chosen-design.png](chosen-design.png) (search row, mountain banner, six statistics, cover row, quick actions, dense detail tabs, reading/loan tables, mobile bottom navigation).

Optional fields added without changing the version-1 import contract: `Book.subtitle`, `Book.coverUrl`, `Book.useFor`, and `Library.recentIds`. Reading History displays the single current reading record explicitly; it does not fabricate earlier reading sessions.

## Amazon wishlist import

`Kindle` is a separate format; it is not treated as EPUB, Logos ownership, or a physical loanable copy. New Amazon records remain Not owned, with reading status Not recorded and no personal rating. Source metadata preserves the supplied ASIN, byline, edition and optional list URL. Valid print ISBN-10 identifiers normalize to ISBN-13 for duplicate matching. Existing records retain their notes, ownership, reading and location. ASIN matching is specific to the Amazon source; format-aware title matching avoids collapsing print and Kindle editions. Source data is evidence, not verified author-role attribution. The importer never infers topics or series from titles.

## Cover provenance and physical verification

Optional `coverSource` holds source name, HTTPS page URL, and selection timestamp. `coverUrl` remains an external image reference. Cover selection never applies title, author, identifiers, series, ownership, location or reading metadata. Open Library work searches are explicitly edition-unverified; ISBN searches display the matched edition.

Optional `edition` is editable; older physical imports display the preserved `sourceMetadata.Edition` until edited. Optional `verification` holds `status` (Not checked / Needs correction / Confirmed), `checkedAt` (local date) and `notes`. Missing verification means Not checked, independent of imported catalog confidence. Confirmation requires a date and is reset on saved changes to title, subtitle, author, edition, ISBN, publisher, publication year, format, series, volume or current location. Reading, cover, recommended location and personal-note changes retain confirmation. Original catalog review flags are preserved, not rewritten by a physical check.

## Shared database

The database holds rows of `(kind, id, data JSON, updated_at, owner)`; `kind` is one of `book`, `series`, `loan`, `sermon`, `prayer`, `prayerset`, `note`, `ideasource`, `visual`, `hymn`, `liturgy`, `resource`, and new kinds need no schema change. Illustrative `sample-` books, and loans on them, are never saved. The stored JSON is the same validated shape as the backup file, and a library rebuilt from rows is validated before it replaces the local copy. Deletes are real deletes; the recovery copies are D1 time travel and exported backups.

## Sermons

`Library.sermons` holds `Sermon` records (kind `sermon` in the shared database). A sermon is a catalog entry: `manuscript` and `recording` are locations, not contents. `scripture` is written one way on import and read by `src/lib/scripture.ts` into book/chapter/verse ranges so searches match by overlap. `sourceId` is the file number used to lay archive reviews over a sermon. Fields from a review (`structure*`, `centralImage`, `gospelHandle`, `opening`, `closing`, `scriptureSource`) carry their source and are only ever filled when empty. Older backups without sermons still restore, and restoring one keeps existing sermons.

## Scanning, covers and summaries

A scanned ISBN identifies the edition. `applyScan` fills only blank author/publisher/year, saves the ISBN with provenance in `sourceMetadata` (`ISBN lookup method`, `Summary source`), and adds a cover or summary only when chosen. `coverUrl` may be a bundled image, an https address, or a small `data:image/jpeg` photo (150,000 characters at most); `coverSource.url` is empty for a photo. Published summaries are third-party wording and are always stored with their source.

## Sermon manuscripts

Full text is not part of the library payload. D1 holds `sermon_text (sermon_id, body, chars, hash, file_name, indexed, updated_at)` and an FTS5 table `sermon_fts` (porter stemming) over the same text. `hash` is the SHA-256 of the extracted text, so re-uploading a folder saves only changed files. `indexed = 0` keeps the text but leaves it out of search. API: `GET /api/sermon-text` (status), `GET|PUT|PATCH|DELETE /api/sermon-text/:id`, `GET /api/sermon-search?q=`, `GET /api/sermon-export?after=`. Queries are rewritten to quoted words joined by AND, so punctuation cannot break the search.

## Sermon review

`reviewNote` (confidence and evidence from an approved review) and `formerTitles` (titles replaced by a review) are set only when a change is approved. `scriptureSource` and `structureSource` become `Review (approved)` when those fields change through a review. A review row matches a sermon by `Sermon ID`, or by file number when that number is unique; unmatched rows are reported. Blank cells and values equal to the current one are ignored.

## Prayers

`Library.prayers` (kind `prayer`) holds `Prayer` records: `type` is Bidding, Sermon starter, Prayer or Devotion; biddings carry `category`, `categoryKey` (`sick`, `grieving` and `birthdays` take names when building) and `categoryNote`. Text never includes the closing response, which `buildPrayers` adds once. `Library.prayerSets` (kind `prayerset`) holds built services: the inputs, and the built text with names only when `namesKept`. Restoring an older backup keeps existing prayers.

## Occasional services

`Sermon.subject` (whom a funeral, wedding or ordination was for). `occasionKind` recognizes the kind of service from `occasion`, `title`, `series` and `subject`; `isPrivateOccasion` is true for funerals and weddings, whose manuscripts default to `indexed = 0` and which are excluded from the review package unless included.

## Devotions and notes

`notes` records (kind `note`): id, title, kind (Devotion, Sermon note, Illustration, Idea, Study
note), body (max 30,000 characters), scripture, date, sermonId, tags, source, updatedAt. Older
backups without `notes` restore without erasing notes already in the library.

## Children's messages
Stored as `notes` with kind "Children's message" or "Chapel message". The Devotions & Notes page
shows the other kinds; Children's Messages shows these two.

## Hymns and liturgies
`hymns` (kind `hymn`): title, firstLine, tune, composer, lyricist, arranger, meter, scripture,
year, key, hymnal, usage[], themes[], text, copyright, links[{label,url}], files[{kind,location}],
notes, source, sourceId. `liturgies` (kind `liturgy`): title, kind, season, date, items[{kind,label,
hymnId,scripture,text}], files[], notes. The RUF Hymnbook index is bundled at
`public/data/ruf-hymnbook.json` (titles, credits and links only). Older backups without these
collections restore without erasing them.

## Attachments
A hymn's `attachments` list holds `{id, name, mime, size, addedAt}`. The bytes are in D1 tables
`attachment` and `attachment_piece` (base64 in 600,000-character rows), served at
`/api/attachments/:id` (PUT to store, GET to read, DELETE to remove). Served with `nosniff` and `sandbox` headers. Accepted types and limits are under Stored files.

## Music resources
`resources` (kind `resource`): title, kind (Artist, Album, Article, Book, Songbook, Website,
Other), creator, year, place, link, notes, tags[], files[{kind,location}], attachments[]. The
Retuned Hymn Movement list is bundled at `public/data/retuned-resources.json` (source
"Retuned Hymn Movement list", one sourceId per row). Older backups without `resources` restore
without erasing them.

## Liturgies held whole
A liturgy item now also has `files[]` and `attachments[]` (its music); a liturgy has `attachments[]`
for the whole. Kinds: Setting (a rite kept for reuse), Sunday service, Season, Occasion, Other. Item
kinds add Music and Rubric. Attachments are reference-counted across hymns, resources, liturgies
and their parts, so files shared by a copied service are deleted only when unused.

## Stored files
Attachments accept JPEG, PNG, WebP, GIF, PDF (served inline) and music/slide/Finale/Word/audio files
(`.musx .mus .etf .mxl .mscz .sib .pptx .ppt .key .docx .doc .mp3 .m4a .wav .mid`; stored with type
`application/octet-stream`, served as downloads). 8 MB each. Zip-based formats and mp3 must start
like their type. "Attach files" on Hymns uploads a chosen folder's files (three at a time) and
attaches them; the rest keep their location only.

A sermon's `attachments` list holds its stored original files (same shape as a hymn's). Text files
(`.txt .md .rtf`) are accepted as downloads too. The attachment routes are open to anyone with the
Hymns or Sermons part turned on.
