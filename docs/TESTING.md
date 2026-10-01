# Testing

Node 24 and npm. CI (`.github/workflows/check.yml`) runs on every push and pull request:
`npm ci`, `npm run check`, install Chromium, `npm run test:e2e`, and uploads `test-results/` if
anything fails.

| Command | What it runs |
| --- | --- |
| `npm run lint` | oxlint |
| `npm test` | Vitest over `src/lib` and `worker` (model, import and backup shapes, sync, scripture parsing, Worker routes, attachments, usage, access) |
| `npm run build` | `tsc -b` then `vite build` |
| `npm run check` | lint, tests, build |
| `npm run test:e2e` | Playwright specs in `tests/`, run in a desktop and an iPhone 13 (Chromium) project |

Browser specs cover the Library (add/edit, search, series, wishlist, loans, import, export,
scanning, covers, verification), sermons and manuscripts, review, prayers, notes, ideas, visuals,
hymns and liturgies, people and permissions, attachments, storage readout, and the first-run
bundled lists. Tests use invented data in the same shapes as real data; real catalogs, sermon
files and prayers are never fixtures.

## Visual criteria

The selected design is [chosen-design.png](chosen-design.png): navy sidebar, cool mountain banner
with serif headline and quote, six small statistics, a row of covers, compact quick actions,
tabbed book detail, compact reading and loan tables, and persistent bottom navigation on phones.
When changing the Library shell, check at about 900 px and 390 px wide:

- The hierarchy above is preserved and quick actions follow the cover row without much scrolling.
- No page-level horizontal overflow at 390 px; dense tables scroll inside their own region.
- Serif display text (Georgia) and sans UI text (Roboto) with system fallbacks; navy navigation,
  pale cool surfaces, teal primary actions.
- Real edition covers or the explicitly unidentified generic cover are used; no CSS-drawn fake
  covers. Asset origins are in [assets.md](assets.md).
- Counts come from records, never copied sample figures.
- No console errors or warnings on load.

The original design QA pass (September 28, 2026, concluded passed) is in git history as
`design-qa.md`.
