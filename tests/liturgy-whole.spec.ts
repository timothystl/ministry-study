import { test, expect } from '@playwright/test'
import { nav } from './helpers'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNkYPhfz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC',
  'base64',
)

test('a liturgy is kept whole, with its words and music, and a service starts from it', async ({
  page,
}) => {
  const stored = new Map<string, Buffer>()
  const deleted: string[] = []
  await page.route('**/api/attachments/*', async (route) => {
    const request = route.request()
    const id = request.url().split('/').pop()!
    if (request.method() === 'PUT') {
      stored.set(id, request.postDataBuffer()!)
      return route.fulfill({ json: { ok: true } })
    }
    if (request.method() === 'DELETE') {
      deleted.push(id)
      stored.delete(id)
      return route.fulfill({ json: { ok: true } })
    }
    return stored.has(id)
      ? route.fulfill({ body: stored.get(id)!, contentType: 'image/png' })
      : route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/')
  await nav(page, 'Liturgies')
  await page.getByRole('button', { name: 'Add liturgy' }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Title', { exact: true }).fill('Divine Service, Setting 3')
  await form.getByRole('combobox').first().selectOption('Setting')
  await form.getByRole('button', { name: 'Add to the service' }).click()
  await form.getByLabel('Item 1 kind').selectOption('Liturgy text')
  await form.getByLabel('Item 1 name').fill('Kyrie')
  await form.getByLabel('Item 1 text').fill('In peace let us pray to the Lord.\nLord, have mercy.')
  await form.getByRole('button', { name: 'Add a file for this part' }).click()
  await form.getByLabel('Item 1 file 1 location').fill('Music/kyrie.musx')
  await form.getByRole('button', { name: 'Add to the service' }).click()
  await form.getByLabel('Item 2 kind').selectOption('Prayer')
  await form.getByLabel('Item 2 name').fill('Collect')
  await form.getByLabel('Item 2 text').fill('Almighty God, grant us your peace.')
  await form.getByRole('button', { name: 'Save liturgy' }).click()

  await expect(page.getByRole('heading', { name: 'Divine Service, Setting 3' })).toBeVisible()
  const parts = page.locator('.liturgy-part')
  await expect(parts).toHaveCount(2)
  await expect(parts.nth(0)).toContainText('Lord, have mercy.')
  await expect(parts.nth(0)).toContainText('Music/kyrie.musx')
  await expect(parts.nth(1)).toContainText('Almighty God, grant us your peace.')

  await parts.nth(0).getByLabel('Attach photos or PDFs').setInputFiles({
    name: 'kyrie music.png',
    mimeType: 'image/png',
    buffer: png,
  })
  await expect(parts.nth(0).getByRole('img', { name: 'kyrie music.png' }).first()).toBeVisible()
  expect(stored.size).toBe(1)

  await page.getByRole('button', { name: 'Start a new service from this' }).click()
  await expect(
    page.getByRole('heading', { name: 'Divine Service, Setting 3 (copy)' }),
  ).toBeVisible()
  await expect(page.locator('.liturgy-part')).toHaveCount(2)
  await expect(page.locator('.liturgy-part').nth(0)).toContainText('Lord, have mercy.')
  await expect(page.getByRole('img', { name: 'kyrie music.png' }).first()).toBeVisible()

  // Removing the copy keeps the music the setting still uses.
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await page.getByRole('button', { name: 'Yes, remove' }).click()
  await page.getByRole('button', { name: /Divine Service, Setting 3/ }).click()
  await expect(page.getByRole('img', { name: 'kyrie music.png' }).first()).toBeVisible()
  expect(deleted).toHaveLength(0)
  expect(stored.size).toBe(1)
})
