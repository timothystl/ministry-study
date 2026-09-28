# Library v0.1 data model and scope

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

## Explicitly deferred

Research a Text, Scripture reading/languages/patterns, hymn/music, sermons, teaching resources, external-resource discovery, EPUB/PDF reading, full-text indexing, provider APIs, automatic cover enrichment, spreadsheet/photo import and reconciliation, cloud sync/authentication, and automatic organization recommendations.

## Source review

Implementation was informed by the uploaded consolidated ministry-study handoff, the local project summary/catalog plans, the original conversation's Mockup #1 design description and Option B pull-quote preference, and the physical interface handoff's import contract. The broader scope in those handoffs is superseded by the explicit Library-only v0.1 request. The initial written-only interpretation was rejected. The user supplied `Codex Image Sep 28, 2026, 02_08_15 PM.png` as the authoritative visual target; the interface was rebuilt around its search row, mountain banner, six statistics, cover row, quick actions, dense detail tabs, reading/loan tables, and mobile bottom navigation.

Optional fields added without changing the version-1 import contract: `Book.subtitle`, `Book.coverUrl`, `Book.useFor`, and `Library.recentIds`. Reading History displays the single current reading record explicitly; it does not fabricate earlier reading sessions.

## Amazon wishlist import

`Kindle` is a separate format; it is not treated as EPUB, Logos ownership, or a physical loanable copy. New Amazon records remain Not owned, with reading status Not recorded and no personal rating. Source metadata preserves the supplied ASIN, byline, edition and optional list URL. Valid print ISBN-10 identifiers normalize to ISBN-13 for duplicate matching. Existing records retain their notes, ownership, reading and location. ASIN matching is specific to the Amazon source; format-aware title matching avoids collapsing print and Kindle editions. Source data is evidence, not verified author-role attribution. The importer never infers topics or series from titles.
