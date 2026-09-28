# Continue Ministry Study at home

Repository: https://github.com/timothystl/ministry-study
Branch: main
Latest application commit: 44568a3 (wishlist CSV import).

## Start in a fresh Codex task

You do not need to locate the old conversation. Open Codex on the home computer, sign in, and give it the CONTINUE prompt below. Let it clone the repository into a local folder and open that folder as the project. Ask Codex to read HANDOFF.md in this repository. The selected design is also in the repository at docs/chosen-design.png.

## CONTINUE prompt

Continue work on https://github.com/timothystl/ministry-study, branch main. Clone it if needed and read README.md, docs/data-model.md, docs/assets.md, and design-qa.md before making changes. Read HANDOFF.md in the repository and inspect docs/chosen-design.png. Preserve the chosen navy-sidebar, mountain-banner Library design. Set up the app locally and, if the user has transferred their personal backup, help restore it through Library Data → Restore a backup → Choose backup → confirm. If the backup is unavailable, start with the illustrative samples and continue development. Do not commit the backup or other private catalog data. Wishlist CSV/pasted-list import is complete; Amazon wishlist import is pending the user's share link or saved page. Do not expand scope or redesign the app. First get the existing app running and report what is ready.

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

Wishlist CSV import accepts Title and optional Author, ISBN, Series, Notes; it includes a template, preview, duplicate handling, and existing-record preservation. Pasted lists accept Title | Author. New imports start Not owned. Amazon integration is NOT built yet; do not claim it is complete. Ask for the wishlist share link or a saved copy when resuming that feature.

React + TypeScript + Vite, plain CSS, Lucide, Zod, localStorage. GitHub checks passed for the latest app commit: model/import tests, build/lint/TypeScript, desktop/mobile workflows. Personal catalog files remain ignored under private/. Physical-library spreadsheet import is deferred until cleaned and reviewed.

## Find this again

Open https://github.com/timothystl/ministry-study/blob/main/HANDOFF.md on the home computer. Start a fresh Codex task with: “Continue https://github.com/timothystl/ministry-study. Read HANDOFF.md first and get the existing app running locally.” The old conversation is not required.
