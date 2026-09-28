import { test, expect, type Page } from '@playwright/test'
async function nav(page: Page, name: string) {
  const opener = page.getByRole('button', { name: 'Open navigation', exact: true })
  if (await opener.isVisible()) await opener.click()
  await page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('button', { name: name === 'Loans1' ? /^Loans/ : name, exact: true })
    .click()
}
async function addBook(page: Page, title: string, owned = true) {
  await nav(page, 'Add Book')
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Title', { exact: true }).fill(title)
  await dialog.getByLabel('Author / contributors').fill('Test Author')
  await dialog
    .getByRole('combobox', { name: 'Ownership', exact: true })
    .selectOption(owned ? 'Owned' : 'Not owned')
  await dialog.getByRole('combobox', { name: 'Reading status', exact: true }).selectOption('Read')
  await dialog.getByRole('combobox', { name: 'Series', exact: true }).fill('Test Series')
  await dialog.getByLabel('Topics (separate with semicolons)').fill('Theology; Grace')
  await dialog.getByLabel('Personal notes').fill('Remember this insight about mercy.')
  await dialog.getByLabel('On my wishlist').check()
  await dialog.getByRole('button', { name: 'Save book' }).click()
  await expect(page.locator('.book-detail')).toBeVisible()
}
test('add, edit, search, series and reading without ownership persist', async ({ page }) => {
  await page.goto('/')
  await addBook(page, 'A remembered book', false)
  await expect(page.locator('.book-detail')).toContainText('Not owned')
  await page.reload()
  await nav(page, 'Reading')
  await expect(page.getByRole('button', { name: /A remembered book/ })).toBeVisible()
  await nav(page, 'Search')
  await page.getByLabel('Search entire library').fill('mercy')
  await expect(page.getByRole('heading', { name: 'A remembered book', exact: true })).toBeVisible()
  await nav(page, 'Browse')
  await page.getByRole('button', { name: 'Series', exact: true }).click()
  await page.getByRole('button', { name: 'Test Series 1', exact: true }).click()
  await page.getByRole('heading', { name: 'A remembered book', exact: true }).click()
  await page.locator('.detail-top').getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill('A revised book')
  await page.getByRole('button', { name: 'Save book' }).click()
  await expect(page.locator('.book-detail')).toContainText('A revised book')
  await nav(page, 'Wishlist')
  await expect(page.getByRole('heading', { name: 'A revised book', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('loan, return and loan history retain the physical home', async ({ page }) => {
  await page.goto('/')
  await addBook(page, 'A shared book')
  await page.locator('.detail-top').getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Shelf', { exact: true }).first().fill('4')
  await page.getByRole('button', { name: 'Save book' }).click()
  await page.locator('.use-for').getByRole('button', { name: 'Loan book', exact: true }).click()
  await page.getByLabel('Loaned to').fill('Example Reader')
  await page.getByRole('button', { name: 'Save loan' }).click()
  await expect(page.locator('.book-detail')).toContainText('Loaned to Example Reader')
  await expect(page.locator('.book-detail')).toContainText('Shelf 4')
  await nav(page, 'Loans1')
  await page.getByRole('button', { name: 'Return', exact: true }).click()
  await page.getByRole('button', { name: /Loan History/ }).click()
  await expect(page.getByRole('button', { name: /A shared book/ })).toBeVisible()
  await expect(page.locator('.loans-table')).toContainText('Returned')
})
test('catalog imports preview, deduplicate and export', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Import your catalog', exact: true }).click()
  const rows = [
    {
      'Resource ID': 'LLS:EXAMPLE',
      Title: 'Catalog resource',
      Authors: 'Example Author',
      License: 'Temporary',
      Subjects: 'Grace',
      Series: 'Sample series',
    },
  ]
  await page.getByLabel('Choose Logos JSON', { exact: true }).setInputFiles({
    name: 'catalog.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(rows)),
  })
  await expect(page.getByRole('dialog')).toContainText('1 resources to add')
  await page.getByRole('button', { name: 'Confirm import' }).click()
  await page.getByLabel('Search entire library').fill('catalog')
  await page.getByRole('heading', { name: 'Catalog resource' }).click()
  await page.getByText('Catalog source', { exact: true }).click()
  await expect(page.locator('.book-detail')).toContainText(
    'Temporary — current access has not been verified',
  )
  await expect(page.locator('.book-detail')).toContainText('Not owned')
  await nav(page, 'Library Data')
  await page.getByLabel('Choose Logos JSON', { exact: true }).setInputFiles({
    name: 'catalog.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(rows)),
  })
  await expect(page.getByRole('dialog')).toContainText(
    '0 resources to add; 1 existing resources left unchanged',
  )
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('ministry-study.backup.json')
})
test('responsive dashboard, real assets and keyboard dismissal', async ({ page }, info) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Recently Viewed' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.locator('.recent-book img').first()).toBeVisible()
  await expect
    .poll(() =>
      page
        .locator('.recent-book img')
        .first()
        .evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 1),
    )
    .toBe(true)
  await page.screenshot({ path: `test-results/home-${info.project.name}.png`, fullPage: true })
  await nav(page, 'Add Book')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('wishlist CSV previews, preserves existing records and avoids duplicate imports', async ({
  page,
}) => {
  await page.goto('/')
  await nav(page, 'Wishlist')
  await page.getByRole('button', { name: 'Import wishlist', exact: true }).click()
  await page.getByRole('button', { name: 'CSV file', exact: true }).click()
  const csv =
    'Title,Author,ISBN,Series,Notes\nSurprised by Hope,N. T. Wright,9780061551826,,Do not replace notes\nA wishlist import,Example Author,,Wishlist Series,"A note, with commas"\nA wishlist import,Example Author,,Wishlist Series,\n'
  await page
    .getByLabel('Choose wishlist CSV', { exact: true })
    .setInputFiles({ name: 'wishlist.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: 'Preview import', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('1 new books; 1 existing books')
  await expect(page.getByRole('dialog')).toContainText('Already listed')
  await page.getByRole('button', { name: 'Import 2 books', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'A wishlist import', exact: true })).toBeVisible()
  await page.getByRole('heading', { name: 'Surprised by Hope', exact: true }).click()
  await expect(page.locator('.book-detail')).toContainText('Owned')
  await expect(page.locator('.book-detail')).toContainText('Bookcase 2')
  await page.reload()
  await nav(page, 'Wishlist')
  await page.getByRole('heading', { name: 'A wishlist import', exact: true }).click()
  await expect(page.locator('.book-detail')).toContainText('Not owned')
  await expect(page.locator('.book-detail')).toContainText('A note, with commas')
})

test('Amazon saved-page import recognizes books, skips non-books and preserves source', async ({
  page,
}) => {
  await page.goto('/')
  await nav(page, 'Wishlist')
  await page.getByRole('button', { name: 'Import wishlist', exact: true }).click()
  await page.getByRole('button', { name: 'Amazon', exact: true }).click()
  const html = `<html><h2 id="profile-list-name">Example list</h2><ul id="g-items">
<li><div id="itemInfo_PRINT"><a id="itemName_PRINT" href="/dp/0060693339/">Example Print Book</a><span id="item-byline-PRINT">by Example Author (Paperback)</span><span id="twisterText">Format : Paperback</span></div></li>
<li><div id="itemInfo_DIGITAL"><a id="itemName_DIGITAL" href="/dp/B012345678/">Example Kindle Book</a><span id="item-byline-DIGITAL">by Example Author (Kindle Edition)</span><span id="twisterText">Format : Kindle</span></div></li>
<li><div id="itemInfo_OTHER"><a id="itemName_OTHER" href="https://evil.test/dp/B000000000/">A notebook</a></div></li>
<li><div id="itemInfo_AUDIO"><a id="itemName_AUDIO" href="/dp/B000000001/">Audio item</a><span id="item-byline-AUDIO">by Example Author (Audible Audiobook)</span></div></li>
</ul><script>document.body.dataset.importExecuted='true'</script></html>`
  await page
    .getByLabel('Choose saved Amazon page', { exact: true })
    .setInputFiles({ name: 'amazon.html', mimeType: 'text/html', buffer: Buffer.from(html) })
  await expect(page.getByRole('region', { name: 'Amazon import preview' })).toContainText(
    '4 entries found · 2 selected · 2 new books',
  )
  await expect(page.getByRole('checkbox', { name: /A notebook/ })).not.toBeChecked()
  await expect(page.getByRole('checkbox', { name: /Audio item/ })).toBeDisabled()
  expect(await page.locator('body').getAttribute('data-import-executed')).toBeNull()
  await expect(page.getByRole('button', { name: 'Import 2 books from Amazon' })).toBeDisabled()
  await page
    .getByRole('checkbox', { name: 'I have checked the selected books and the item count.' })
    .check()
  await page.getByRole('button', { name: 'Import 2 books from Amazon' }).click()
  await page.getByRole('heading', { name: 'Example Kindle Book', exact: true }).click()
  await expect(page.locator('.book-detail')).toContainText('Kindle')
  await expect(page.locator('.book-detail')).toContainText('Not owned')
  await page.getByText('Catalog source', { exact: true }).click()
  await expect(page.locator('.book-detail')).toContainText('Amazon wishlist')
  await expect(page.locator('.book-detail')).toContainText('B012345678')
  await page.reload()
  await nav(page, 'Wishlist')
  await expect(
    page.getByRole('heading', { name: 'Example Kindle Book', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Import wishlist', exact: true }).click()
  await page.getByRole('button', { name: 'Amazon', exact: true }).click()
  await page
    .getByLabel('Choose saved Amazon page', { exact: true })
    .setInputFiles({ name: 'amazon.html', mimeType: 'text/html', buffer: Buffer.from(html) })
  await expect(page.getByRole('region', { name: 'Amazon import preview' })).toContainText(
    '0 new books · 0 existing books',
  )
  await expect(page.getByRole('region', { name: 'Amazon import preview' })).toContainText(
    '2 selected entries are already on your wishlist',
  )
})
