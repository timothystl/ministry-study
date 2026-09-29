import { test, expect, type Page } from '@playwright/test'

async function nav(page: Page, name: string) {
  const opener = page.getByRole('button', { name: 'Open navigation', exact: true })
  if (await opener.isVisible()) await opener.click()
  await page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('button', { name, exact: true })
    .click()
}
test('add sermons, import a list, and find them by passage', async ({ page }) => {
  await page.goto('/')
  await nav(page, 'Sermons')
  await expect(page.getByText('No sermons yet')).toBeVisible()

  await page.getByRole('button', { name: 'Add sermon' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Title', { exact: true }).fill('The Lost Son')
  await dialog.getByLabel('Scripture').fill('Luke 15:11–32')
  await dialog.getByLabel('Date preached').fill('2025-03-16')
  await dialog.getByLabel('Series').fill('Lent 2025')
  await dialog.getByLabel('Themes (separate with semicolons)').fill('grace; home')
  await dialog.getByLabel('Manuscript location').fill('https://onedrive.example/lost-son')
  await dialog.getByRole('button', { name: 'Save sermon' }).click()
  await expect(page.getByRole('heading', { name: 'The Lost Son' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open' })).toHaveAttribute(
    'href',
    'https://onedrive.example/lost-son',
  )
  await page.getByRole('button', { name: 'All sermons' }).click()

  await page.getByRole('button', { name: 'Import list' }).click()
  const importer = page.getByRole('dialog')
  await importer
    .getByRole('textbox', { name: /^Sermon list/ })
    .fill('2023-09-10 Luke 15 Lost and Found.docx\n2024-01-28 1 Cor 13 Love.docx\nAdvent talk.docx')
  await importer.getByLabel(/Folder the files are in/).fill('OneDrive/Sermons')
  await importer.getByRole('button', { name: 'Preview import' }).click()
  await expect(importer.getByText('3 to add; 0 already in your catalog')).toBeVisible()
  await importer.getByRole('button', { name: 'Import 3 sermons' }).click()

  await page.getByLabel('Search sermons').fill('Luke 15:5')
  await expect(page.getByText('Lost and Found')).toBeVisible()
  await expect(page.getByText('The Lost Son')).toHaveCount(0)
  await page.getByLabel('Search sermons').fill('Luke 15')
  await expect(page.getByText('2 matches')).toBeVisible()
  await expect(page.getByText('Passage').first()).toBeVisible()

  await page.getByRole('button', { name: /Lost and Found/ }).click()
  await expect(page.getByRole('heading', { name: 'Other sermons on this passage' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'The Lost Son' })).toBeVisible()

  await page.reload()
  await nav(page, 'Sermons')
  await expect(page.getByText('4 sermons in your catalog')).toBeVisible()
})

test('an archive index and text history import, then search finds an image', async ({ page }) => {
  await page.goto('/')
  await nav(page, 'Sermons')
  await page.getByRole('button', { name: 'Import list' }).click()
  const index = [
    'Index,Date,Liturgical Season,Occasion,Scripture,Title,Path,SuggestedFilename',
    '1,2005.01.09,Epiphany,Epiphany 1,Isa 42.1-7,Waves,2005-Current/0001_Epiphany 1_Waves.docx,0001_Epiphany 1_Waves.docx',
    '2,2005.02.06,Lent,Lent 2,Fear and Great Joy,Wheat,2005-Current/0002_Lent 2_Wheat.docx,0002_Lent 2_Wheat.docx',
  ].join('\n')
  await page.getByLabel('Choose list file').setInputFiles({
    name: 'index.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(index),
  })
  await page.getByRole('button', { name: 'Preview import' }).click()
  await expect(page.getByText('1 things could not be read')).toBeVisible()
  await page.getByRole('button', { name: 'Import 2 sermons' }).click()

  await page.getByRole('button', { name: 'Import list' }).click()
  await page.getByRole('button', { name: 'Text history' }).click()
  const history = [
    '## Isaiah',
    '### Isaiah 42:1-7',
    '**“Waves”** — 2005-01-09 (Epiphany 1)',
    '- **Opens:** “When the waves come.”',
    '- **Central image:** A tide that cannot be argued with.',
    '- **File:** `0001_Epiphany 1_Waves.docx`',
  ].join('\n')
  await page.getByLabel('Choose history file').setInputFiles({
    name: 'history.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(history),
  })
  await expect(page.getByText('1 sermons will be updated')).toBeVisible()
  await page.getByRole('button', { name: 'Save these changes' }).click()

  await page.getByLabel('Search sermons').fill('tide')
  await expect(page.getByRole('button', { name: /Waves/ })).toBeVisible()
  await expect(page.getByText('Text in central image')).toBeVisible()
  await page.getByLabel('Search sermons').fill('Isaiah 42:3')
  await expect(page.getByText('1 match', { exact: false })).toBeVisible()
})
