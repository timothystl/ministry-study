# Operations

## Hosting

The Worker `ministry-study` serves `https://study.timothystl.org` on Cloudflare (`wrangler.jsonc`).
There is no deploy workflow in this repository; earlier documentation says the Cloudflare project
is connected to this GitHub repository, so a merge to `main` is expected to build and publish.
Confirm the connection and the latest deployed revision in the Cloudflare dashboard before
relying on this. Do not declare an `r2_buckets` binding before the bucket exists, or deploys fail.

## Variables and secrets (names only)

Set in the Cloudflare dashboard (Settings, Variables and Secrets). Nothing here is in
`wrangler.jsonc` except a comment, so a dashboard setting is the only copy.

| Name | Purpose |
| --- | --- |
| `STUDY_ACCESS_TEAM_DOMAIN` | Cloudflare Access team domain (`...cloudflareaccess.com`) |
| `STUDY_ACCESS_AUD` | Audience tag of the Access application |
| `STUDY_ADMIN_EMAIL` | Administrator's sign-in address; the API refuses everyone without it |
| `ESV_API_KEY` | Crossway ESV key (same free key the Connect app uses); ESV column off without it |
| `BIBLIA_API_KEY` | Faithlife Biblia key; Biblia group absent without it |
| `YVP_APP_KEY` | YouVersion Platform app key; YouVersion group absent without it |

Cloudflare API tokens used elsewhere are tracked in
[Connect's token audit](https://github.com/timothystl/Connect/blob/main/docs/CLOUDFLARE_TOKENS.md).

## One-time shared library setup

The app works locally and the API refuses all requests until this is done.

1. Confirm `name` in `wrangler.jsonc` matches the existing Cloudflare project for
   `study.timothystl.org`.
2. In Zero Trust, Access, Applications, protect `study.timothystl.org` (self-hosted; allow only
   the people who should see the library). Without it the site is public and the repository is
   public.
3. Set the three `STUDY_*` variables above before deploying.
4. Deploy. The D1 database `timothy-study-db` was created in the dashboard and is referenced by ID
   in `wrangler.jsonc`.

The first device to open the app is offered "Save this library to the shared library"; later
devices adopt it. Whether Access and the variables are set in production was not re-verified for
this documentation.

To let another person in: add them on the People page and add their email to the Access policy.

## Local development

- UI only: `npm ci`, `npm run dev -- --host 127.0.0.1 --port 4173` (Node 24; browser storage only).
- With the Worker: `npx wrangler dev` with `STUDY_DEV_NO_AUTH=1` in an ignored `.dev.vars`.

Each browser origin (host and port) has its own local data; clearing site data removes the local
copy.

## Backups and restore

- Library data, Export backup: versioned JSON, the private off-Cloudflare copy. Restore: Library
  data, Restore a backup, choose the file, review the count, confirm; it replaces the current
  library in that browser. Export before restoring.
- Sermons, Manuscripts, Download all manuscripts: zip of plain text, outside Cloudflare.
- D1 keeps 30 days of point-in-time recovery. Stored files (hymn and sermon attachments) live in
  D1 and are not in the JSON backup.
- Personal backups are never committed. A combined private backup (1,111 candidate physical records
  and 661 Logos records, prepared September 28, 2026, before later edits) was kept outside the
  repository; a current export from the live library supersedes it.

## Limits

- Stored files: 8 MB each (D1). Reference photos are shrunk to about 1 MB. Large uploads can fail
  on the Workers free plan's CPU limit; if so lower `MAX_ATTACHMENT` or move file bytes to R2
  (create the bucket, then add the binding). Which Cloudflare plan applies was not verified.
- A photo cover stored in a book record is capped at 150,000 characters.
