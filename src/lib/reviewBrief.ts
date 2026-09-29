// Instructions that travel inside the review package, for whoever reads the sermons (a person,
// or Claude Cowork). The file it asks for is exactly what the app's Review import reads.
export const REVIEW_BRIEF = `# Sermon review: instructions

You are helping Pastor Andrew Dinger (Timothy Lutheran Church, LCMS, St. Louis) tidy the catalog of
his preaching archive. This package has:

- catalog.csv: one row per sermon, with what the catalog says now.
- manuscripts/: the full text of each sermon that has a manuscript. The Text File column of
  catalog.csv gives each sermon's file.
- structures.txt: the sermon structures already used in the catalog, if any.

## The goal

Read each manuscript and propose corrections and additions to its catalog record, so the catalog
becomes accurate and easy to search: the right Scripture passage, a clear title, a date only when
one is known, a short summary, themes, and the sermon's structure. Andrew will review every proposal
before anything changes, so accuracy matters more than volume.

## What to produce

One file named review.csv (UTF-8, with a header row). Use these column names exactly:

Sermon ID, Title, Scripture, Date, Series, Occasion, Church Season, Themes, Summary, Structure,
Structure Category, Central Image, Gospel Statement, Confidence, Evidence

- Sermon ID is required and copied exactly from catalog.csv. One row per sermon.
- Leave a cell blank when you have nothing to propose. A blank never changes anything.
- Only include a sermon if you propose at least one change.
- Confidence is high, medium or low for the row as a whole.
- Evidence is one short sentence quoting or pointing to the words in the manuscript that support
  the row (for example: "Opens with the Gospel reading, Luke 15:11-32").

## Rules

1. Use only what is in the manuscript and the catalog. Never invent a date, a passage, a series, a
   quotation, or facts about the sermon. If you are not sure, leave the cell blank or lower the
   confidence.
2. Scripture: write passages as Book chapter:verse, such as Luke 15:11-32, or several separated by
   semicolons. Propose one only when the manuscript clearly preaches it or names it as the text.
   Do not propose a passage just because it is quoted in passing.
3. Title: propose a new title only when the current one is missing, is only a file name or
   occasion, is a duplicate of another sermon's title, or is clearly unclear. Keep Andrew's voice:
   short, plain, no clickbait. If the current title is fine, leave Title blank. Never change a
   title just to polish it.
4. Date: propose one only if the manuscript itself states it. Write it as YYYY-MM-DD.
5. Summary: one or two plain sentences saying what the sermon says, in your own words. Do not
   quote long passages. Leave it blank if the catalog already has a good one.
6. Themes: a few short topics separated by semicolons (for example: grace; forgiveness; home).
7. Structure: choose from the names in structures.txt. Use the closest existing name when one fits;
   propose a new name only when none fit, and say why in Evidence. Structure Category is
   Thematic, Textual or Dynamic. Give one best-fit structure per sermon.
8. Central Image and Gospel Statement: the governing image or metaphor of the sermon, and the most
   direct statement of the gospel to the hearer ("for you"), in one sentence each, close to the
   manuscript's own words. Leave blank when there is none.
9. Funerals, weddings and other pastoral occasions may name real families. Do not copy personal
   details into any field. Summaries for those sermons should be general.
10. Do not rewrite, correct or comment on the sermons themselves. This review is about the catalog
    record only.

## When you are unsure

Prefer a blank cell with a low-confidence note in Evidence over a guess. Andrew can always ask again
about a particular sermon.
`
