import { strToU8, zipSync } from 'fflate'
import { test, expect, type Page } from '@playwright/test'
import { nav } from './helpers'

// The shared-library endpoints for manuscripts, as a small in-memory server.
async function manuscriptServer(page: Page) {
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
  await expect(dialog.getByText('Saved 1 manuscripts.')).toBeVisible()
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
