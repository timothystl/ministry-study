import { strToU8, zipSync } from 'fflate'
import { test, expect, type Page } from '@playwright/test'
import { nav } from './helpers'

// Original files stored with sermons, kept per page.
const storedByPage = new WeakMap<Page, Map<string, { name: string; body: Buffer }>>()
const storedFiles = (page: Page) => storedByPage.get(page)!

// The shared-library endpoints for manuscripts, as a small in-memory server.
async function manuscriptServer(page: Page) {
  const files = new Map<string, { name: string; body: Buffer }>()
  storedByPage.set(page, files)
  await page.route('**/api/attachments/*', async (route) => {
    const request = route.request()
    const id = request.url().split('/').pop()!
    if (request.method() === 'PUT') {
      files.set(id, {
        name: decodeURIComponent(request.headers()['x-file-name']),
        body: request.postDataBuffer()!,
      })
      return route.fulfill({ json: { ok: true } })
    }
    if (request.method() === 'DELETE') {
      files.delete(id)
      return route.fulfill({ json: { ok: true } })
    }
    const file = files.get(id)
    return file
      ? route.fulfill({ body: file.body, contentType: 'application/octet-stream' })
      : route.fulfill({ status: 404, json: {} })
  })
  const rows = new Map<string, { text: string; hash: string; fileName: string; indexed: boolean }>()
  await page.route('**/api/sermon-text', (route) =>
    route.fulfill({
      json: [...rows].map(([id, r]) => ({
        id,
        chars: r.text.length,
        hash: r.hash,
        indexed: r.indexed,
      })),
    }),
  )
  await page.route('**/api/sermon-text/*', async (route) => {
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!)
    const method = route.request().method()
    if (method === 'PUT') {
      const body = route.request().postDataJSON()
      rows.set(id, {
        text: body.text,
        hash: body.hash,
        fileName: body.fileName,
        indexed: body.indexed,
      })
      return route.fulfill({ json: { ok: true } })
    }
    if (method === 'DELETE') {
      rows.delete(id)
      return route.fulfill({ json: { ok: true } })
    }
    if (method === 'PATCH') {
      const row = rows.get(id)
      if (row) row.indexed = route.request().postDataJSON().indexed
      return route.fulfill({ json: { ok: true } })
    }
    const row = rows.get(id)
    return row
      ? route.fulfill({ json: { ...row, chars: row.text.length, updatedAt: 'now' } })
      : route.fulfill({ status: 404, json: { error: 'none' } })
  })
  await page.route('**/api/sermon-search?*', (route) => {
    const q = new URL(route.request().url()).searchParams.get('q')!.toLowerCase()
    const hits = [...rows]
      .filter(([, r]) => r.indexed && r.text.toLowerCase().includes(q))
      .map(([id, r]) => {
        const at = r.text.toLowerCase().indexOf(q)
        return {
          id,
          snippet: `…${r.text.slice(Math.max(0, at - 20), at)}[[${r.text.slice(at, at + q.length)}]]${r.text.slice(at + q.length, at + 40)}…`,
        }
      })
    return route.fulfill({ json: hits })
  })
  return rows
}
const docx = (paragraphs: string[]) =>
  Buffer.from(
    zipSync({
      'word/document.xml': strToU8(
        `<w:document xmlns:w="x"><w:body>${paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`,
      ),
    }),
  )

test('save manuscripts, read them on the sermon, and search their words', async ({ page }) => {
  const rows = await manuscriptServer(page)
  await page.goto('/')
  await nav(page, 'Sermons')
  await page.getByRole('button', { name: 'Import list' }).click()
  await page
    .getByRole('textbox', { name: /^Sermon list/ })
    .fill('2025-03-16 Luke 15 The Lost Son.docx\n2024-01-28 1 Cor 13 Love.docx')
  await page.getByRole('button', { name: 'Preview import' }).click()
  await page.getByRole('button', { name: 'Import 2 sermons' }).click()

  await page.getByRole('button', { name: 'Manuscripts' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('0 of 2 sermons have saved text.')).toBeVisible()
  await dialog.getByLabel('Choose manuscript files').setInputFiles([
    {
      name: '2025-03-16 Luke 15 The Lost Son.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: docx(['A father had two sons.', 'The younger asked for his share.']),
    },
    {
      name: 'Unknown sermon.docx',
      mimeType: 'application/octet-stream',
      buffer: docx(['Not in the catalog.']),
    },
  ])
  await expect(dialog.getByText('1 new manuscripts to save')).toBeVisible()
  await expect(dialog.getByText('1 files that match no sermon in your catalog')).toBeVisible()
  await dialog.getByRole('button', { name: 'Save 1 manuscripts' }).click()
  await expect(dialog.getByText('Saved 1 manuscripts; stored 1 original files.')).toBeVisible()
  expect(rows.size).toBe(1)
  await dialog.getByRole('button', { name: 'Close dialog' }).click()

  await page.getByLabel('Search sermons').fill('younger asked')
  await expect(page.getByText('In the manuscript')).toBeVisible()
  await expect(page.locator('mark')).toHaveText('younger asked')
  await page.getByRole('button', { name: /The Lost Son/ }).click()
  await expect(page.getByLabel('Manuscript text').getByText('A father had two sons.')).toBeVisible()

  await page.getByLabel('Include in search').uncheck()
  await page.getByRole('button', { name: 'All sermons' }).click()
  await page.getByLabel('Search sermons').fill('younger asked')
  await expect(page.getByText('0 matches')).toBeVisible()
})

test('a funeral sermon is saved but kept out of search unless asked', async ({ page }) => {
  const rows = await manuscriptServer(page)
  await page.goto('/')
  await nav(page, 'Sermons')
  await page.getByRole('button', { name: 'Import list' }).click()
  await page
    .getByRole('textbox', { name: /^Sermon list/ })
    .fill(
      'Title,Occasion,Subject,Path\nHope at the grave,Funeral,Mary Example,funeral-mary.docx\nWaves,,,waves.docx\n',
    )
  await page.getByRole('button', { name: 'Preview import' }).click()
  await page.getByRole('button', { name: 'Import 2 sermons' }).click()
  await page.getByLabel('Kind of service').selectOption('Funeral & memorial')
  await expect(page.getByText('Hope at the grave')).toBeVisible()
  await expect(page.getByText('Waves')).toHaveCount(0)
  await page.getByLabel('Kind of service').selectOption('')

  await page.getByRole('button', { name: 'Manuscripts' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Choose manuscript files').setInputFiles([
    {
      name: 'funeral-mary.docx',
      mimeType: 'application/octet-stream',
      buffer: docx(['We gather in sorrow and hope.']),
    },
    {
      name: 'waves.docx',
      mimeType: 'application/octet-stream',
      buffer: docx(['The waves came crashing down.']),
    },
  ])
  await expect(
    dialog.getByText('Include the 1 funeral and wedding sermons in search'),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Save 2 manuscripts' }).click()
  await expect(dialog.getByText('Saved 2 manuscripts; stored 2 original files.')).toBeVisible()
  expect([...rows.values()].map((r) => r.indexed).sort()).toEqual([false, true])
  await dialog.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByLabel('Search sermons').fill('sorrow and hope')
  await expect(page.getByText('0 matches')).toBeVisible()
  await page.getByLabel('Search sermons').fill('crashing')
  await expect(page.getByText('In the manuscript')).toBeVisible()
})

test('the original sermon files are stored too, once, and open from the sermon', async ({
  page,
}) => {
  await manuscriptServer(page)
  await page.goto('/')
  await nav(page, 'Sermons')
  await page.getByRole('button', { name: 'Import list' }).click()
  await page
    .getByRole('textbox', { name: /^Sermon list/ })
    .fill('2025-03-16 Luke 15 The Lost Son.docx\n2024-01-28 1 Cor 13 Love.docx')
  await page.getByRole('button', { name: 'Preview import' }).click()
  await page.getByRole('button', { name: 'Import 2 sermons' }).click()

  const choose = async () => {
    await page.getByRole('button', { name: 'Manuscripts' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Choose manuscript files').setInputFiles([
      {
        name: '2025-03-16 Luke 15 The Lost Son.docx',
        mimeType: 'application/octet-stream',
        buffer: docx(['A father had two sons.']),
      },
      {
        name: '2024-01-28 1 Cor 13 Love.docx',
        mimeType: 'application/octet-stream',
        buffer: docx(['Love is patient.']),
      },
    ])
    return dialog
  }
  const first = await choose()
  await expect(first.getByText(/2 to store/)).toBeVisible()
  await first.getByRole('button', { name: 'Save 2 manuscripts' }).click()
  await expect(first.getByText('Saved 2 manuscripts; stored 2 original files.')).toBeVisible()
  expect([...storedFiles(page).values()].map((f) => f.name).sort()).toEqual([
    '2024-01-28 1 Cor 13 Love.docx',
    '2025-03-16 Luke 15 The Lost Son.docx',
  ])
  await first.getByRole('button', { name: 'Close dialog' }).click()

  // The same folder again: the text is unchanged and the files are already stored.
  const second = await choose()
  await expect(second.getByText(/0 to store/)).toBeVisible()
  await second.getByRole('button', { name: 'Close dialog' }).click()

  await page.getByRole('button', { name: /The Lost Son/ }).click()
  await expect(
    page
      .getByRole('region', { name: 'Sermon files' })
      .getByText('2025-03-16 Luke 15 The Lost Son.docx'),
  ).toBeVisible()
  expect(storedFiles(page).size).toBe(2)
})
