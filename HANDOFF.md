# Continue Ministry Study at home

Repository: https://github.com/timothystl/ministry-study
Branch: main
Latest application changes: CSV/pasted-list and Amazon saved-page/copied-text wishlist import.

## Start in a fresh Codex task

You do not need to locate the old conversation. Open Codex on the home computer, sign in, and give it the CONTINUE prompt below. Let it clone the repository into a local folder and open that folder as the project. Ask Codex to read HANDOFF.md in this repository. The selected design is also in the repository at docs/chosen-design.png.

## CONTINUE prompt

Continue work on https://github.com/timothystl/ministry-study, branch main. Clone it if needed and read README.md, docs/data-model.md, docs/assets.md, and design-qa.md before making changes. Read HANDOFF.md in the repository and inspect docs/chosen-design.png. Preserve the chosen navy-sidebar, mountain-banner Library design. Set up the app locally and, if the user has transferred their personal backup, help restore it through Library Data → Restore a backup → Choose backup → confirm. If the backup is unavailable, start with the illustrative samples and continue development. Do not commit the backup or other private catalog data. Wishlist CSV/pasted-list and Amazon saved-page/copied-text import are implemented. Direct URL retrieval and automatic Amazon sync are not implemented. Do not expand scope or redesign the app. First get the existing app running and report what is ready.

## Setup commands for Codex

Use Node.js 24 and npm. In the cloned repository:

    npm ci
    npm run check
    npm run dev -- --host 127.0.0.1 --port 4173

Open http://127.0.0.1:4173/ on the home computer after the server is running. The old computer's localhost links do not transfer the running server.

For browser tests:

    npx playwright install chromium
    npm run test:e2e

## Restore the catalog

The personal backup is NOT in this public repository. A separate local handoff ZIP was prepared on the original computer with a 661-resource Logos backup (606 permanent, 55 temporary licenses), source snapshot and design image. That backup was prepared during the initial build on September 28, 2026 and may not include later browser edits. You can continue building at home with the sample library even without that backup. If you have edited the real library since then, export a fresh backup from the old computer using Library Data → Export backup and transfer that file instead.

At home, open Library Data → Restore a backup → Choose backup. If you transferred a backup, select its JSON, review the count, and confirm. Restore replaces the sample/current library in that browser. No need to re-import Logos after restoring.

The real library used port 4173; port 4174 was a separate illustrative design preview. Each browser/origin has separate local data. GitHub transfers code, not browser storage. There is no cloud database or sync yet. Keep this personal backup private and outside the public repository.

## Product boundaries and current state

v0.1 includes the responsive shell and Library only: dashboard, unified catalog/notes search, topic/author/series/shelf browse, My Collection, Reading including unowned books, active loans and history, Wishlist, add/edit/detail, import/export. Ownership, reading, circulation, current location and recommended organization are independent. Series are first-class.

Research a Text, Scripture/pattern tools, hymns/music, sermons, teaching resources and broader modules are explicitly deferred. Use-for tags such as Sermon are book metadata, not additional modules.

The exact selected design is docs/chosen-design.png. The user rejected an earlier visual direction; preserve this reference. The implemented app uses verified real cover editions and a generated mountain panorama, so imagery differs slightly from the concept.

Wishlist CSV import accepts Title and optional Author, ISBN, Series, Notes; it includes a template, preview, duplicate handling, and existing-record preservation. Pasted lists accept Title | Author. New imports start Not owned. Amazon import now accepts saved HTML pages or copied English list-view text. The share link opens Amazon; it does not fetch automatically. HTML retains ASINs, bylines, edition and approved cover URLs; text captures recognized title/byline pairs only. Kindle is separate from physical books. Users review counts and selection; unrecognized items start unchecked and unsupported formats cannot be selected. Load Amazon through End of list before saving/copying. No personal wishlist contents or share URL are tracked in Git. Do not claim automatic URL import or synchronization.

React + TypeScript + Vite, plain CSS, Lucide, Zod, localStorage. GitHub checks passed for the latest app commit: model/import tests, build/lint/TypeScript, desktop/mobile workflows. Personal catalog files remain ignored under private/. Physical-library spreadsheet import is deferred until cleaned and reviewed.

## Find this again

Open https://github.com/timothystl/ministry-study/blob/main/HANDOFF.md on the home computer. Start a fresh Codex task with: “Continue https://github.com/timothystl/ministry-study. Read HANDOFF.md first and get the existing app running locally.” The old conversation is not required.

## Latest update: covers and physical checks

The live address is https://study.timothystl.org on Cloudflare, connected to GitHub. Online cover lookup and physical-copy verification are implemented; see README.md for the user flow. Search supports Open Library title/author or ISBN editions, requires choosing a cover, and never overwrites bibliography. Confirmation requires checking identity, edition and current shelf location. Edits to identity/location clear confirmation. Catalog filters and Next to check support shelf review. Original import issues remain in source metadata, separate from the user’s verification notes.

A private combined backup with 1,111 candidate physical records plus 661 Logos records was supplied outside the repo. It excludes the pending Amazon import and does not represent later browser edits. Do not commit personal catalog files. The app still uses local browser storage; hosting does not provide cross-device sync.

ISBN lookup is now available from book detail. It searches Open Library works, fetches paginated edition records, validates ISBN checksums, and requires the user to confirm the edition before saving the selected identifier. It changes only the ISBN plus source provenance and retains the existing physical verification reset rules. The physical import has no recorded ISBNs; no bulk ISBN assignments have been made.

## Latest update: shared library database

The library can now save to a free Cloudflare D1 database (see README → Shared library database). The code is done and tested locally; it stays inactive, and the API refuses requests, until Cloudflare Access protection and the two `STUDY_ACCESS_*` variables are set. Planned order after this: sermons, children's messages, Bible studies and notes, hymns, then Scripture tools.

## Latest update: sermon catalog

Sermons is built (see README → Sermons): passage search, import of an archive index, text history and structure review, and a shared-database record kind. Next: save full manuscript text for search and backup (needs a separate table, not the library payload), then occasional sermons (funerals, weddings, ordinations), devotions, prayers and notes (the earlier prayer catalog is still to be brought in), and a visual library. ISBN lookup and cover search are to be merged into one flow.

## Latest update: ISBN and cover in one step, scanning, photos, summaries

Find ISBN and cover is now one lookup; Scan a Book reads barcodes (camera, or typed ISBN) and matches or adds books; a cover photo can be taken; published summaries are offered with their source. See README → Finding a book's ISBN, cover and summary. Photo covers are stored inside the record (small JPEG); if many are taken, move images to Cloudflare R2.

## Latest update: sermon manuscripts

Full manuscript text can be saved, searched and downloaded (README → Sermon manuscripts). Next: an export of the catalog and a review import that shows old and new values side by side, so an outside review (such as a Cowork pass over the manuscripts) can propose better titles, passages, themes and structures for approval; then occasional sermons, devotions, prayers and notes, and a visual library.

## Latest update: catalog export and review import

Sermons → Review builds a package (catalog.csv, manuscripts, structures, instructions) for an outside reader and approves what it returns field by field. Next: occasional sermons (funerals, weddings, ordinations), devotions, prayers and notes (the earlier prayer catalog still needs to be brought in), and a visual library.

## Latest update: prayers

Prayers is built (README → Prayers): library, import of the Prayers of the Church builder file, a builder with names and a live preview, and saved services. Next: occasional sermons (funerals, weddings, ordinations) and devotions/sermon notes in the same family, then a visual library.

## Ideas for later

**AI drafting of prayers (chosen for later: a claude.ai page).** The original Prayers of the Church builder drafted new biddings by calling Claude straight from the browser, which only works inside claude.ai. Instead of adding an API key to this app, publish a small drafting page on claude.ai (an Artifact that can ask Claude for a draft using the pastor's own Claude account). It would use the builder's rules (2–4 sentences, address God directly, concrete nouns, no "be with us", no therapeutic language, end "Lord, in your mercy,") and the pastor's Every Moment Holy voice, and hand its drafts to the app as a file that Prayers → Import prayers already reads (the same JSON shape as the builder's `LIBRARY`). No new cost, no key to keep. An in-app "Draft with AI" button (needs a paid Anthropic API key kept as a Cloudflare secret, with a spending limit) was considered and set aside for now.

**Other AI uses that fit the same pattern.** Cloudflare Workers AI (models that run on the existing Cloudflare account, with a small free daily allowance) for "sermons like this one" search and automatic tags; a model with vision for reading a photo of a shelf or a book cover; Claude for anything written in the pastor's voice. Avoid free tiers that may train on the input for anything private (funerals, weddings, pastoral notes).

**On-device models (evaluated, not now).** Small models such as Gemma or Phi can run on the phone or in the browser with nothing sent anywhere: private, free per use, and usable offline. The catch is quality: small models are noticeably weaker at writing in the pastor's voice and at careful classification, and a first use downloads a large model file. Google's MediaPipe LLM Inference Android and iOS versions are in maintenance mode (LiteRT-LM is the successor); the web version is still supported, and MLC's WebLLM also runs in a browser. This app is a web app, so in-browser is the relevant form, not a native phone app. A possible later use: a private mode that tags or summarizes sensitive sermons (funerals, weddings) without them leaving the device.

**Chatbot builders (Voiceflow, Botpress).** These build visitor-facing chatbots, so they fit the church website or Connect (service times, events, forwarding prayer requests), not this study library. Voiceflow is hosted only (free tier, then about $60 a month); Botpress has a free pay-as-you-go plan plus AI usage, and its old self-hosted version is retired. Any use belongs to the Website and Connect plans, not here.

**OpenClaw (skipped for now).** An open-source personal AI agent that runs on your own computer, reads and writes files, runs commands and controls a browser, and answers through messaging apps. In 2026 it had serious security problems (a one-click remote-code-execution flaw, over 100,000 instances exposed to the internet, and malicious add-ons on its marketplace). It should not run on a computer that holds church, giving, or pastoral data. Claude Cowork already covers reading and organizing files.

## Latest update: occasional services

Funerals, weddings and ordinations: For field, Kind of service filter, private-by-default handling (README → Funerals, weddings and ordinations). The Church season and Structure filters on the sermon list did not filter until this change; fixed. Waiting on the pastor's list of occasional sermons to import; the master index has almost none. Next: devotions and sermon notes, then a visual library.

## Latest update: devotions, notes, and scanning on Add Book
Devotions & Notes page (search, kinds, import, notes on each sermon's page). Add Book and the open
book page both have a barcode scan. Next: children's messages, then hymns; still waiting on the
funeral/wedding/ordination list.

## Latest update: funeral, wedding and ordination list
File numbers with a letter (F012, W003, O001) are now read like the archive's numbers. A wedding's occasion now decides its kind, so "Christ Memorial" no longer makes it a funeral. The list itself contains family names and lives outside the repository.

## Latest update: children's messages
New page over the notes records (two audiences). Next: hymns. Ideas: props/objects as a field,
grade level, a "reuse next year" flag.

## Latest update: hymns and liturgies
Hymns catalog (RUF Hymnbook index, CSV import, attach files from a folder) and Liturgies.
Not done: Hymnary.org lookups (it blocks automated requests, so each hymn links to a Hymnary
search); reading a hymn's details from Finale files; PowerPoint contents. Ideas: hymn use history
by Sunday, suggested hymns for a sermon passage, LSB numbers import.
