import { test, expect } from '@playwright/test'
import { nav } from './helpers'

// A small in-memory stand-in for the shared library, so the app treats itself as connected.
test('the hymnbook and the Retuned Hymn Movement list are added by themselves, once', async ({
  browser,
}) => {
  let revision = 0
  const rows = new Map<string, { kind: string; id: string; data: string }>()
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  await context.route('**/api/library', (route) =>
    route.fulfill({ json: { revision, records: [...rows.values()] } }),
  )
  await context.route('**/api/changes', async (route) => {
    const body = route.request().postDataJSON()
    if (body.baseRevision !== revision)
      return route.fulfill({ status: 409, json: { error: 'changed-elsewhere', revision } })
    for (const r of body.upserts) rows.set(`${r.kind}:${r.id}`, r)
    for (const r of body.deletes) rows.delete(`${r.kind}:${r.id}`)
    revision++
    return route.fulfill({ json: { ok: true, revision } })
  })
  const page = await context.newPage()
  await page.goto('/')
  await expect
    .poll(() => [...rows.values()].filter((r) => r.kind === 'hymn').length)
    .toBeGreaterThan(150)
  await expect
    .poll(() => [...rows.values()].filter((r) => r.kind === 'resource').length)
    .toBeGreaterThan(400)
  await nav(page, 'Hymns')
  await expect(page.getByText(/hymns in your catalog/)).toBeVisible()
  await page.getByLabel('Search hymns').fill('luther')
  await expect(page.getByText('A Mighty Fortress Is Our God')).toBeVisible()
  await nav(page, 'Music Resources')
  await page.getByLabel('Search resources').fill('love unknown')
  await expect(page.getByRole('button', { name: /Love Unknown/ }).first()).toBeVisible()

  // A second start adds nothing more.
  const before = rows.size
  await page.reload()
  await nav(page, 'Hymns')
  await expect(page.getByText(/hymns in your catalog/)).toBeVisible()
  await page.waitForTimeout(1500)
  expect(rows.size).toBe(before)
  await context.close()
})

test('they are added without the shared library too', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  await context.route('**/api/library', (route) => route.fulfill({ status: 503, json: {} }))
  const page = await context.newPage()
  await page.goto('/')
  await nav(page, 'Hymns')
  await expect(page.getByText(/hymns in your catalog/)).toBeVisible()
  await nav(page, 'Music Resources')
  await expect(page.getByText(/resources$/).first()).toBeVisible()
  await context.close()
})
