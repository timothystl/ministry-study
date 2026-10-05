# Ministry Study — Agent Instructions

Created October 5, 2026, modeled on the sibling Timothy repositories.

## Working agreement

Andrew's request authorizes the implementation, tests, documentation, commits, PR merge, and
routine deployment needed to finish that request. This applies equally to Codex, Claude, and
other agents. Carry the work through to a usable result; do not stop at a draft PR or ask again
for approval already given. Follow an explicit review-only, no-deploy, or other scope limit.

Deliver a coherent feature or fix in a sensible batch. Do not manufacture tiny increments,
separate approvals for each file, numbered preparation gates, or evidence packets. Split work
only when dependencies, rollback risk, or a real product decision justify it. Update useful
documentation when behavior or ownership changes; normal commits and PRs are the work record.

Ask only when a material decision is missing, the work would expand the requested scope, or an
action would destroy data, irreversibly affect people, or create a new financial commitment
not already authorized. Complete independent work while that decision is pending. A routine
production release is not, by itself, a reason to ask. Do not send real messages or initiate
real charges merely to test an application.

Preserve unrelated work and shared history. Use a branch/worktree as useful, inspect concurrent
changes, and resolve routine conflicts. Do not force-push or reset someone else's work.
Current code, configuration, tests, and observed deployments outrank dated prose.

## Verification and reporting

Match verification to the change. Run meaningful tests for changed behavior and required CI;
do not invent tests or rebuild applications solely for Markdown edits. For documentation-only
work, review the diff, validate links and factual claims, and let applicable CI run.
For releases, confirm the deployed revision and relevant checks. Report what shipped and any
material limitation honestly; a green build is not proof of data migration or user acceptance.

## Talking with Andrew

Andrew is a pastor, not a developer. Do not narrate your steps or mention files, scripts,
commands, branches, or tools in messages to him. Reply in plain language, Answer in a direct, concise manner without outlining your steps, in this order:

1. Restate the issue in your own words, so he knows you understood it.
2. If it is a bug, say what you confirmed is actually going wrong.
3. Give the resolution: what changed, whether it is live yet, and anything he needs to do or check.

Keep technical detail in commits and PRs, not in chat.

## Documentation policy

This is the current agent policy; `CLAUDE.md` imports it. Read only task-relevant references.
Older approval language in plans, runbooks, comments, and archived evidence is superseded by
this working agreement. Keep useful technical procedures and data protections, but do not
revive retired preparation gates, waived baselines, or repeated release signoffs.
The current overhaul status is maintained in
[the architecture plan](https://github.com/timothystl/digital-architecture/blob/main/architecture/11-overhaul-readiness-and-execution-plan.md).
Keep durable instructions here and detailed progress there. Reference docs are in `docs/`
(start with `docs/ARCHITECTURE.md` and `docs/OPERATIONS.md`); unfinished work is in
[docs/OPEN-WORK.md](docs/OPEN-WORK.md). Current code and `wrangler.jsonc` outrank dated prose.

## Runtime and ownership

- The GitHub repository is `timothystl/ministry-study`, and it is public. It is Andrew's personal ministry
  workspace (library, sermons, prayers, notes, hymns and liturgies, images and clips, Bible study), with
  separate per-person libraries for a few other people. It stands alone from the other Timothy apps: its
  own Worker, database, and sign-in, with no service binding to them.
- Worker `ministry-study` (`worker/index.ts`, `wrangler.jsonc`) serves the React/Vite build in `dist/` as
  static assets and runs first for `/api/*`. Documented hostname: `study.timothystl.org`. The wrangler file
  declares no routes, so the hostname comes from the existing Cloudflare project and is unverified here.
  Keep the Worker `name` matching that project.
- Data: Cloudflare D1 `timothy-study-db` (binding `DB`); the Worker creates tables on first use. There is no
  R2 binding; do not add one before the bucket exists. Each browser also keeps a local `localStorage` copy.
  Records include sermons, manuscripts, prayers, notes, attachments, and the People access list.
- Authentication: the Worker verifies the Cloudflare Access token (`worker/access.ts`) using
  `STUDY_ACCESS_TEAM_DOMAIN` and `STUDY_ACCESS_AUD`; with those unset the API refuses everyone, and with
  `STUDY_ADMIN_EMAIL` unset it answers 503. `STUDY_DEV_NO_AUTH=1` bypasses sign-in for local development
  only (ignored `.dev.vars`); never set it in production. Whether the Access application and these variables
  are actually configured in production is UNVERIFIED; the repository cannot show it. Do not claim it is.
- Authorization is server-side: the administrator (`STUDY_ADMIN_EMAIL`) has every part; others are added on the
  People page and are limited to their granted parts and their own library; the administrator cannot read
  other libraries. UI hiding is never the only lock. Preserve funeral and wedding sermons being kept out of
  search and review packages by default.
- Because the repository is public, never put real catalogs, backups, sermon files, prayers, or family
  names in `src/`, `public/`, fixtures, tests, or docs; use invented data, and ignored `private/` and
  `*.backup.json` for personal files. Never log catalog, sermon, note, or prayer content. Secret and
  variable names (`STUDY_*`, `ESV_API_KEY`, `BIBLIA_API_KEY`, `YVP_APP_KEY`) are in docs/OPERATIONS.md;
  never write values. This repo uses no Cloudflare API-token secrets in GitHub; the token map is
  [Connect's CLOUDFLARE_TOKENS.md](https://github.com/timothystl/Connect/blob/main/docs/CLOUDFLARE_TOKENS.md).
- Do not copy streaming video or scrape sites that block automated requests (see docs/OPEN-WORK.md).

## Tests and releases

Use Node 24 (CI uses 24; README and docs say the same). Run `npm ci`, then `npm run check` (oxlint, Vitest over
`src/lib` and `worker`, `tsc -b`, and `vite build`) and, for changed browser behavior,
`npx playwright install chromium` and `npm run test:e2e` (desktop and iPhone 13 projects, in `tests/`).
CI (`.github/workflows/check.yml`) runs both on every push and pull request. Unit tests sit beside the code;
test data is invented. Documentation-only changes need no rebuild.

There is no deploy workflow in this repository. Earlier documentation says the Cloudflare project is
connected to GitHub so a merge to `main` publishes; that is UNVERIFIED. After merging a change that affects the
running app, confirm the deployed revision in Cloudflare (or ask Andrew) rather than assuming. Merge completed
work after CI is green; the working agreement supplies the authorization. Do not send real messages or alter
production data merely to test.
