# Open work and ideas

Status as of October 1, 2026, taken from the former `HANDOFF.md` (a running diary, removed in
this cleanup; it is in git history) and checked against the code. The product boundary is in
[ARCHITECTURE.md](ARCHITECTURE.md); built behavior is in [FEATURES.md](FEATURES.md).

## Not built

- Children's messages extras: props/objects field, grade level, "reuse next year" flag (ideas).
- Hymns: Hymnary.org lookups (it blocks automated requests, so each hymn links to a search);
  reading hymn details from Finale files; PowerPoint contents; hymn use history by Sunday;
  suggested hymns for a sermon passage; LSB number import (waiting on the LSB index pages as photos
  or PDF to turn into a CSV). Hymns from Cardiphonia's Retuned Hymnal database and cardiphonia.org
  were unreachable from the build environment, so they are added by link or attached lead sheets.
- Liturgies: build a liturgy from an existing PowerPoint (one slide per part) or Word file.
- Music resources: link a resource to the hymns found on it; an "album to hymns" import.
- Occasional sermons: waiting on Andrew's list of funeral, wedding and ordination sermons (the list
  holds family names and stays outside the repository).
- Images & Clips: uploading clips (Stream, private with signed URLs) and moving photos to R2.
  Film scenes stay as links with timestamps; do not copy streaming video.
- Illustrations & Ideas and Images & Clips planned items not built: see the status table in
  [collectors-scope.md](collectors-scope.md).
- Copy a resource between people's libraries; per-person backups.
- Saved collections (from the Search mockup), a dark-green sidebar and a Search landing page.
- Physical-library spreadsheet importer, Scripture pattern tools (Research a Text is built; saved collections and outside-resource discovery are not), EPUB/PDF
  reading, full-text indexing of books (see [data-model.md](data-model.md)).
- Bulk file storage beyond 8 MB per file (whole hymnal scans, large recordings): needs R2.

## To confirm

- Production state of Cloudflare Access protection and the `STUDY_*` variables (see
  [OPERATIONS.md](OPERATIONS.md)); not verifiable from the repository.
- Which Cloudflare plan and products (Workers Paid, R2, Images, Stream) the account has; earlier
  notes say Workers Paid, R2 and Images/Stream are available but this was not re-verified.
- Which video license Timothy holds beyond CVLI, if the "licensed through the church" wording
  needs refining.

## Decisions and evaluations (September 2026)

- **AI drafting of prayers:** done outside the app as a claude.ai page ("Prayer Writer") that uses
  the pastor's own Claude account and hands drafts to Prayers, Import prayers as a JSON file. No
  API key is stored in this app; an in-app "Draft with AI" button (paid API key as a Cloudflare
  secret with a spending limit) was set aside.
- **Other AI uses that would fit the same pattern:** Cloudflare Workers AI for "sermons like this
  one" search and tags; a vision model for shelf or cover photos; Claude for anything in the
  pastor's voice. Avoid free tiers that may train on private input (funerals, weddings, pastoral
  notes).
- **On-device models** (Gemma, Phi, in-browser runtimes such as WebLLM): private and free per use
  but weaker at the pastor's voice and careful classification, and the first use downloads a large
  model. A possible later private mode for sensitive sermons.
- **Chatbot builders (Voiceflow, Botpress)** are visitor-facing; they belong to the Website and
  Connect plans, not here.
- **OpenClaw:** skipped; it should not run on a computer that holds church, giving or pastoral
  data. These evaluations were not re-verified in October 2026.
