import { test, expect } from '@playwright/test'
import { addBook, nav } from './helpers'

test('build a bibliography from the library and by hand, in different styles', async ({ page }) => {
  await page.goto('/')
  await addBook(page, 'An Invented Book on Prayer', 'Example Author')
  await page.locator('.detail-top').getByRole('button', { name: 'Cite', exact: true }).click()
  const cite = page.getByRole('dialog', { name: 'Cite this book' })
  await cite.getByLabel('Place of publication').fill('St. Louis')
  await expect(cite.locator('.bib-entry')).toContainText(
    'Author, Example. An Invented Book on Prayer.',
  )
  await cite.getByRole('button', { name: 'Add to bibliography' }).click()
  await expect(cite.getByRole('button', { name: 'In your bibliography' })).toBeDisabled()
  await cite.getByRole('button', { name: 'Close dialog' }).click()

  await nav(page, 'Bibliography')
  await page.getByRole('button', { name: 'Add a source', exact: true }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Kind of source').selectOption('Journal article')
  await form.getByLabel('Author(s)').fill('Sample Writer')
  await form.getByLabel('Article title').fill('A Made-Up Article')
  await form.getByLabel('Journal', { exact: true }).fill('Journal of Examples')
  await form.getByLabel('Volume', { exact: true }).fill('12')
  await form.getByLabel('Year', { exact: true }).fill('2020')
  await form.getByLabel('Pages', { exact: true }).fill('1-20')
  await form.getByLabel('Page cited').fill('5')
  await form.getByRole('button', { name: 'Save source' }).click()

  const bibliography = page.getByLabel('Bibliography', { exact: true }).locator('.bib-entry')
  await expect(bibliography).toHaveCount(2)
  await expect(bibliography.nth(1)).toContainText(
    'Writer, Sample. “A Made-Up Article.” Journal of Examples 12 (2020): 1–20.',
  )
  await expect(page.locator('.bib-notes')).toContainText(
    'Sample Writer, “A Made-Up Article,” Journal of Examples 12 (2020): 5.',
  )

  await page.getByLabel('Citation style').selectOption('apa')
  await expect(page.getByRole('heading', { name: 'References' })).toBeVisible()
  await expect(page.locator('.bib-notes')).toContainText('(Writer, 2020, p. 5)')

  // The list is still there after a reload.
  await page.reload()
  await nav(page, 'Bibliography')
  await expect(page.locator('.bib-sources > li')).toHaveCount(2)
})
