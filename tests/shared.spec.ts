import { test, expect, type BrowserContext } from '@playwright/test'

// A small in-memory stand-in for the shared database, used by two separate "devices".
function sharedServer() {
  let revision = 0
  const rows = new Map<string, { kind: string; id: string; data: string }>()
  return async (context: BrowserContext) => {
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
  }
}
test('a book added on one device appears on another', async ({ browser }) => {
  const attach = sharedServer()
  const first = await browser.newContext(),
    second = await browser.newContext()
  await attach(first)
  await attach(second)
  const a = await first.newPage()
  await a.goto('/')
  await expect(a.getByRole('status').filter({ hasText: 'Shared library' })).toBeVisible()
  await a.getByRole('button', { name: 'Add Book' }).first().click()
  const dialog = a.getByRole('dialog')
  await dialog.getByLabel('Title', { exact: true }).fill('Shared between devices')
  await dialog.getByLabel('Author / contributors').fill('Test Author')
  await dialog.getByRole('button', { name: 'Save book' }).click()
  await expect(a.getByRole('status').filter({ hasText: 'up to date' })).toBeVisible()
  const b = await second.newPage()
  await b.goto('/')
  await b.getByRole('button', { name: 'Search' }).first().click()
  await b.getByLabel('Search entire library').fill('Shared between')
  await expect(
    b.getByRole('heading', { name: 'Shared between devices', exact: true }),
  ).toBeVisible()
  await first.close()
  await second.close()
})
