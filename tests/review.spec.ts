import { test, expect } from '@playwright/test'
import { nav } from './helpers'

test('download a review package, then approve a returned review', async ({ page }) => {
  // No shared library here, so the package holds the catalog and instructions only.
  await page.goto('/')
  await nav(page, 'Sermons')
  await page.getByRole('button', { name: 'Import list' }).click()
  await page
    .getByRole('textbox', { name: /^Sermon list/ })
    .fill('0812_Lent 4_The Lost Son.docx\n0813_Lent 5_Waves.docx')
  await page.getByRole('button', { name: 'Preview import' }).click()
  await page.getByRole('button', { name: 'Import 2 sermons' }).click()

  await page.getByRole('button', { name: 'Review' }).click()
  const dialog = page.getByRole('dialog')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Download review package' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('sermon-review-package.zip')
  await expect(dialog.getByText(/catalog only/i).first()).toBeVisible()

  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Catalog only (CSV)' }).click(),
  ])
  const text = await (await import('node:fs/promises')).readFile((await csv.path())!, 'utf8')
  const id = /^([0-9a-f-]{36}),0812,/m.exec(text)![1]

  const review = [
    'Sermon ID,Title,Scripture,Summary,Structure,Confidence,Evidence',
    `${id},The Lost Son,Luke 15.11-32,A father runs to his son.,Law/Gospel,high,"Opens with the Gospel reading"`,
  ].join('\n')
  await dialog.getByLabel('Choose review file').setInputFiles({
    name: 'review.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(review),
  })
  await expect(dialog.getByText('1 sermons with proposals: 3 additions')).toBeVisible()
  // The title replaces the file name, so it is left unapproved until chosen.
  await expect(dialog.getByRole('button', { name: 'Apply 3 approved changes' })).toBeVisible()
  await dialog.getByLabel(/Title replaces/).check()
  await dialog.getByRole('button', { name: 'Apply 4 approved changes' }).click()
  await expect(dialog.getByText('Applied 4 approved changes.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close dialog' }).click()

  await page.getByLabel('Search sermons').fill('Luke 15:20')
  await page.getByRole('button', { name: /The Lost Son/ }).click()
  await expect(page.getByText('A father runs to his son.')).toBeVisible()
  await expect(page.getByText('Former title: 0812 Lent 4 The Lost Son')).toBeVisible()
  await expect(page.getByText('Confidence: high.')).toBeVisible()
})
