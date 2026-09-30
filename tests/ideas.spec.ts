import { test, expect } from '@playwright/test'
import { nav } from './helpers'

test('collect an idea and an illustration, mark it used, and keep it apart from devotions', async ({
  page,
}) => {
  await page.goto('/')
  await nav(page, 'Illustrations & Ideas')
  await expect(page.getByText('Nothing collected yet')).toBeVisible()

  await page.getByLabel('Quick add an idea').fill('Jonah wins the argument and loses the city')
  await page.getByLabel('Quick add an idea').press('Enter')
  await expect(page.getByText('Jonah wins the argument and loses the city')).toBeVisible()

  await page.getByRole('button', { name: 'Add item' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Kind').selectOption('Quote')
  await dialog.getByLabel('Title', { exact: true }).fill('Small mercy')
  await dialog.getByLabel('Scripture').fill('Luke 15:20')
  await dialog.getByLabel('Where it came from').fill('Dillard, Pilgrim at Tinker Creek, p. 9')
  await dialog.getByLabel('Text').fill('The father runs.')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Small mercy' })).toBeVisible()
  await expect(page.getByText('From: Dillard, Pilgrim at Tinker Creek, p. 9')).toBeVisible()
  await expect(page.getByText('Not used yet.')).toBeVisible()

  await page.getByLabel('Sermon or place').fill('The Lost Son')
  await page.getByRole('button', { name: 'Mark as used' }).click()
  await expect(page.getByText(/The Lost Son$/)).toBeVisible()

  await page.getByRole('button', { name: 'All items' }).click()
  await expect(page.getByText(/Used 1×/)).toBeVisible()
  await page.getByLabel('Use').selectOption('unused')
  await expect(page.getByText('Small mercy')).toHaveCount(0)
  await expect(page.getByText('Jonah wins the argument')).toBeVisible()
  await page.getByLabel('Use').selectOption('')
  await page.getByLabel('Search notes').fill('tinker creek')
  await expect(page.getByText('Small mercy')).toBeVisible()

  await nav(page, 'Devotions & Notes')
  await expect(page.getByText('Small mercy')).toHaveCount(0)
})

test('look for illustrations on other sites and save their links', async ({ page }) => {
  await page.goto('/')
  await nav(page, 'Illustrations & Ideas')
  await page.getByLabel('Search notes').fill('Luke 15')
  await page.getByText('Look elsewhere').click()
  const link = page.getByRole('link', { name: 'Search TextWeek' })
  await expect(link).toHaveAttribute(
    'href',
    /duckduckgo\.com\/\?q=site%3Atextweek\.com%20Luke%2015/,
  )

  await page.getByRole('button', { name: 'Paste links' }).click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByLabel('Links')
    .fill('https://rw360.org/blog/the-lost-son-again/ | good for Lent 3\nnot a link')
  await expect(dialog.getByText('1 to add; 1 skipped.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Save 1 link' }).click()

  await page.getByLabel('Search notes').fill('')
  await page.getByRole('button', { name: /The lost son again/ }).click()
  await expect(
    page.getByRole('link', { name: 'https://rw360.org/blog/the-lost-son-again/' }),
  ).toBeVisible()
  await expect(page.getByText('good for Lent 3')).toBeVisible()
})

test('add a site of your own to look elsewhere', async ({ page }) => {
  await page.goto('/')
  await nav(page, 'Illustrations & Ideas')
  await page.getByText('Look elsewhere').click()
  await expect(page.getByRole('link', { name: 'Working Preacher' })).toBeVisible()
  await page.getByLabel('Site name').fill('Example blog')
  await page.getByLabel('Web address').fill('https://www.example.org/blog/')
  await page.getByRole('button', { name: 'Add a site' }).click()
  await expect(page.getByRole('link', { name: 'Example blog' })).toBeVisible()
  await page.getByLabel('Web address').fill('nonsense')
  await page.getByRole('button', { name: 'Add a site' }).click()
  await expect(page.getByRole('alert')).toContainText('web address')
  await page.getByRole('button', { name: 'Remove Example blog' }).click()
  await expect(page.getByRole('link', { name: 'Example blog' })).toHaveCount(0)
})

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNkYPhfz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC',
  'base64',
)

test('a photo taken on the page becomes a scrap at once', async ({ page }) => {
  await page.route('**/api/attachments/*', (route) => {
    const method = route.request().method()
    return method === 'GET'
      ? route.fulfill({ body: png, contentType: 'image/png' })
      : route.fulfill({ json: { ok: true } })
  })
  await page.goto('/')
  await nav(page, 'Illustrations & Ideas')
  await page
    .getByLabel('Take a photo of a scrap')
    .setInputFiles({ name: 'card.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('heading', { name: /^Scrap \d{4}-\d{2}-\d{2}$/ })).toBeVisible()
  await expect(page.getByRole('img', { name: 'card.png' })).toBeVisible()
  await page.getByRole('button', { name: 'All items' }).click()
  await expect(page.getByText(/^Scrap \d{4}-\d{2}-\d{2}$/)).toBeVisible()
})
