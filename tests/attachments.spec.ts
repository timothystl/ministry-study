import { test, expect } from '@playwright/test'
import { nav } from './helpers'

// A tiny PNG and PDF, sent to a stand-in for the shared library's file storage.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNkYPhfz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC',
  'base64',
)
const pdf = Buffer.from('%PDF-1.4\n%test\n')

test('attach a photo and a PDF to a hymn, keep them, and remove one', async ({ page }) => {
  const stored = new Map<string, { body: Buffer; type: string }>()
  const deleted: string[] = []
  await page.route('**/api/attachments/*', async (route) => {
    const request = route.request()
    const id = request.url().split('/').pop()!
    if (request.method() === 'PUT') {
      stored.set(id, { body: request.postDataBuffer()!, type: request.headers()['content-type'] })
      return route.fulfill({ json: { ok: true } })
    }
    if (request.method() === 'DELETE') {
      deleted.push(id)
      stored.delete(id)
      return route.fulfill({ json: { ok: true } })
    }
    const file = stored.get(id)
    return file
      ? route.fulfill({ body: file.body, contentType: file.type })
      : route.fulfill({ status: 404, json: { error: 'No such file.' } })
  })
  await page.goto('/')
  await nav(page, 'Hymns')
  await page.getByRole('button', { name: 'Add hymn' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Title', { exact: true }).fill('Abide With Me')
  await dialog.getByRole('button', { name: 'Save hymn' }).click()
  await expect(page.getByText('Nothing attached yet')).toBeVisible()

  await page.getByLabel('Attach photos or files').setInputFiles([
    { name: 'page 312.png', mimeType: 'image/png', buffer: png },
    { name: 'Abide lead sheet.pdf', mimeType: 'application/pdf', buffer: pdf },
  ])
  const list = page.getByRole('region', { name: 'Photos and files' })
  await expect(list.getByText('Abide lead sheet.pdf')).toBeVisible()
  await expect(list.getByRole('img', { name: 'page 312.png' })).toBeVisible()
  expect(stored.size).toBe(2)
  await expect(list.getByRole('img', { name: 'page 312.png' })).toHaveJSProperty('naturalWidth', 10)

  await page.getByLabel('Attach photos or files').setInputFiles({
    name: 'setup.exe',
    mimeType: 'application/x-msdownload',
    buffer: Buffer.from('hello'),
  })
  await expect(page.getByRole('alert')).toContainText('only photos, PDFs, music')
  expect(stored.size).toBe(2)

  await page.reload()
  await nav(page, 'Hymns')
  await page.getByRole('button', { name: /Abide With Me/ }).click()
  await expect(page.getByText('Abide lead sheet.pdf')).toBeVisible()

  await page.getByRole('button', { name: 'Remove Abide lead sheet.pdf' }).click()
  await page.getByRole('button', { name: 'Yes, remove' }).click()
  await expect(page.getByText('Abide lead sheet.pdf')).toHaveCount(0)
  await expect.poll(() => deleted.length).toBe(1)
  expect(stored.size).toBe(1)
})
