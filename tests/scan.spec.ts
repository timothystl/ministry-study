import { test, expect } from '@playwright/test'
import { ISBN, addBook, nav, routes } from './helpers'

test('a typed ISBN matches an existing book, saving its ISBN, cover and summary', async ({
  page,
}) => {
  await routes(page)
  await page.goto('/')
  await addBook(page, 'Mockingbird Theology', 'Test Author')
  await nav(page, 'Scan a Book')
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Or type the ISBN').fill('978-0-06-155182-6')
  await dialog.getByRole('button', { name: 'Look up' }).click()
  await expect(dialog.getByRole('heading', { name: 'Mockingbird Theology' })).toBeVisible()
  await expect(dialog.getByText('Resurrection and the mission of the church.')).toBeVisible()
  await dialog.getByRole('button', { name: /^Yes: Mockingbird Theology/ }).click()
  await expect(dialog.getByText('This session: 0 added, 1 matched, 0 skipped.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close dialog' }).click()
  await nav(page, 'Search')
  await page.getByLabel('Search entire library').fill(ISBN)
  await page.getByRole('heading', { name: 'Mockingbird Theology', exact: true }).click()
  await expect(page.locator('.publication')).toContainText(ISBN)
  await expect(page.locator('.detail-cover img')).toHaveAttribute('src', /covers.openlibrary.org/)
  await expect(page.getByText('Resurrection and the mission of the church.')).toBeVisible()
})

test('an unknown book can be added from a scan, and a bad barcode is refused', async ({ page }) => {
  await routes(page)
  await page.goto('/')
  await nav(page, 'Scan a Book')
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Or type the ISBN').fill('0049000028911')
  await dialog.getByRole('button', { name: 'Look up' }).click()
  await expect(dialog.getByRole('alert')).toContainText('does not look like a book barcode')
  await dialog.getByLabel('Or type the ISBN').fill(ISBN)
  await dialog.getByRole('button', { name: 'Look up' }).click()
  await dialog.getByRole('button', { name: 'Add as a new book' }).click()
  await expect(dialog.getByText('Added “Mockingbird Theology”.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close dialog' }).click()
  await nav(page, 'My Collection')
  await expect(
    page.getByRole('heading', { name: 'Mockingbird Theology', exact: true }),
  ).toBeVisible()
})

test('a photo of the cover is kept small and saved with the book', async ({ page }) => {
  await page.goto('/')
  await addBook(page, 'A book with a photographed cover', 'Author')
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNkYPhfz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC',
    'base64',
  )
  await page.getByLabel('Take or choose a photo of the cover').setInputFiles({
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: png,
  })
  await expect(page.locator('.detail-cover img')).toHaveAttribute(
    'src',
    /^data:image\/jpeg;base64,/,
  )
  await expect(page.getByText('Photo taken by you')).toBeVisible()
  await page.reload()
  await nav(page, 'My Collection')
  await page.getByRole('heading', { name: 'A book with a photographed cover', exact: true }).click()
  await expect(page.locator('.detail-cover img')).toHaveAttribute(
    'src',
    /^data:image\/jpeg;base64,/,
  )
})
