# Ministry Study

A working home for Andrew's sermons, Bible study, hymnody, library and other ministry resources,
hosted at [study.timothystl.org](https://study.timothystl.org). Other people can be given a private
library of their own. It is one of the Timothy apps (see
[digital-architecture](https://github.com/timothystl/digital-architecture)) and stands alone: its
own Worker, database and sign-in.

## What is built

| Part | What it does |
| --- | --- |
| Library | Books, series, reading, loans, wishlist (CSV, pasted list, Amazon page import), Logos import, ISBN and cover lookup, barcode scanning, physical-copy verification |
| Sermons | Catalog with passage search, full manuscript text and search, original files, review and approval of outside suggestions, private handling of funerals and weddings |
| Prayers | Prayer library, Prayers of the Church builder, LCMS weekly prayer, saved services |
| Devotions & Notes, Children's Messages | Notes records with passage search; sermon-page links |
| Illustrations & Ideas, Images & Clips | Quick capture of stories, quotes and scraps; images and video links with licenses |
| Bible Study | Hebrew, Greek and English texts in columns, with tap-a-word Hebrew and Greek study |
| Hymns & Liturgies, Music Resources | Hymn catalog and attached music, whole liturgies, music resource lists |
| People | Administrator-managed access and per-person parts and libraries |

How each part works: [docs/FEATURES.md](docs/FEATURES.md). Not built yet:
[docs/OPEN-WORK.md](docs/OPEN-WORK.md).

## Run locally

Node 24 and npm:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4173
```

Open http://127.0.0.1:4173. With no shared server everything is on and data stays in this
browser's `localStorage`; the public repository contains only illustrative sample books. To run the
Worker too, see [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Checks

```sh
npm run check                 # lint, unit tests, TypeScript, production build
npx playwright install chromium
npm run test:e2e              # desktop and mobile browser workflows
```

GitHub Actions (`.github/workflows/check.yml`) runs both on every push and pull request. Details:
[docs/TESTING.md](docs/TESTING.md).

## Your data

- Personal catalogs, backups, sermon and prayer files, and family names never go in the repository.
  Use ignored `private/` and `*.backup.json`; tests use invented data.
- The signed-in library saves to a Cloudflare D1 database; each browser also keeps a local copy.
  **Library data, Export backup** is the private off-Cloudflare copy; restore it from the same
  page. Backup, restore and recovery details: [docs/OPERATIONS.md](docs/OPERATIONS.md).
- The shared library API refuses all requests until Cloudflare Access and its variables are set.
  Whether that is done in production was not verified for these docs; see Open work.

## Layout

- `src/`: React app (`src/lib/` model, storage, sync, parsers; `src/components/` pages)
- `worker/`: API, D1 storage, Access verification, Bible text proxies
- `public/data/`: shipped Bible texts and starter lists; rebuilt by `scripts/build*.mjs`
- `docs/`: reference documentation (below)
- `tests/`: Playwright specs; unit tests sit beside the code as `*.test.ts`

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): runtime, shared database, API, permissions, security
- [docs/OPERATIONS.md](docs/OPERATIONS.md): hosting, variables and secrets (names only), setup, backups
- [docs/TESTING.md](docs/TESTING.md): checks and visual criteria
- [docs/FEATURES.md](docs/FEATURES.md): how each part works
- [docs/data-model.md](docs/data-model.md): record shapes and rules
- [docs/assets.md](docs/assets.md): image sources; [docs/chosen-design.png](docs/chosen-design.png): selected design
- [docs/collectors-scope.md](docs/collectors-scope.md): scope and status of the two collectors
- [docs/OPEN-WORK.md](docs/OPEN-WORK.md): what is not built, decisions and ideas

## Open work

Full list in [docs/OPEN-WORK.md](docs/OPEN-WORK.md). The main items:

- Confirm production Access protection and Cloudflare variables (not verifiable from the repo).
- Hymn work waiting on source material (LSB index) and occasional-sermon list from Andrew.
- Clip and large-photo storage (R2 or Stream) if the collection outgrows D1.
