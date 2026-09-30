import { test, expect } from '@playwright/test'
import { nav } from './helpers'

test('add a hymn, attach files, and keep a service together', async ({ page }) => {
  await page.goto('/')
  await nav(page, 'Hymns')
  await expect(page.getByText('No hymns yet')).toBeVisible()

  await page.getByRole('button', { name: 'Add hymn' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Title', { exact: true }).fill('Abide With Me')
  await dialog.getByLabel('Composer').fill('William Henry Monk')
  await dialog.getByLabel('Lyricist').fill('Henry Francis Lyte')
  await dialog.getByLabel('Meter').fill('10 10 10 10')
  await dialog.getByLabel('Bible references').fill('Luke 24:29')
  await dialog.getByRole('button', { name: 'Add a file' }).click()
  await dialog.getByLabel('File 1 location').fill('OneDrive/Hymns/Abide With Me.musx')
  await dialog.getByRole('button', { name: 'Save hymn' }).click()
  await expect(page.getByRole('heading', { name: 'Abide With Me' })).toBeVisible()
  await expect(page.getByText('OneDrive/Hymns/Abide With Me.musx')).toBeVisible()
  await expect(page.getByRole('link', { name: /Hymnary\.org/ })).toHaveAttribute(
    'href',
    /hymnary\.org\/search\?qu=Abide/,
  )
  await page.getByRole('button', { name: 'All hymns' }).click()

  await page.getByLabel('Search hymns').fill('')
  await page.getByRole('button', { name: 'Attach files' }).click()
  await page.getByLabel('Choose hymn files').setInputFiles([
    { name: '012 Abide With Me.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') },
    {
      name: 'Zeal Unknown Hymn.musx',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('x'),
    },
    {
      name: 'Be Thou My Vision.pptx',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('x'),
    },
  ])
  const files = page.getByRole('dialog')
  await expect(files.getByText(/1 files to attach to 1 hymns; 2 new hymns/)).toBeVisible()
  await files.getByRole('button', { name: 'Save these' }).click()
  await page.getByLabel('Search hymns').fill('vision')
  await expect(page.getByText('Be Thou My Vision')).toBeVisible()

  await nav(page, 'Liturgies')
  await page.getByRole('button', { name: 'Add liturgy' }).click()
  const l = page.getByRole('dialog')
  await l.getByLabel('Title', { exact: true }).fill('Advent evening prayer')
  await l.getByLabel('Season or day').fill('Advent')
  await l.getByRole('button', { name: 'Add to the service' }).click()
  await l.getByLabel('Item 1 name').fill('Opening hymn')
  await l.getByLabel('Item 1 hymn').selectOption({ label: 'Abide With Me' })
  await l.getByRole('button', { name: 'Add to the service' }).click()
  await l.getByLabel('Item 2 name').fill('Closing hymn')
  await l.getByLabel('Item 2 hymn').selectOption({ label: 'Be Thou My Vision' })
  await l.getByRole('button', { name: 'Move item 2 up' }).click()
  await l.getByRole('button', { name: 'Add a file' }).click()
  await l.getByLabel('File 1 location').fill('Liturgy/advent.pptx')
  await l.getByRole('button', { name: 'Save liturgy' }).click()
  await expect(page.getByRole('heading', { name: 'Advent evening prayer' })).toBeVisible()
  const order = page.locator('.liturgy-order li')
  await expect(order.nth(0)).toContainText('Closing hymn')
  await expect(order.nth(0)).toContainText('Be Thou My Vision')
  await expect(page.getByText('Liturgy/advent.pptx')).toBeVisible()

  await page.getByRole('button', { name: 'Be Thou My Vision' }).click()
  await expect(page.getByRole('heading', { name: 'Be Thou My Vision' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Advent evening prayer' })).toBeVisible()
})
