import { test, expect } from '@playwright/test'
import { nav } from './helpers'

test('add the Retuned Hymn Movement list, then add a resource as it is used', async ({ page }) => {
  await page.goto('/')
  await nav(page, 'Music Resources')
  await expect(page.getByText('No resources yet')).toBeVisible()

  await page.getByRole('button', { name: 'Retuned Hymn Movement list' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Look at the list' }).click()
  await expect(dialog.getByText(/to add; 0 already/)).toBeVisible()
  await dialog.getByRole('button', { name: /^Add \d+ resources$/ }).click()
  await page.getByLabel('Search resources').fill('love unknown')
  await page.getByRole('button', { name: /Love Unknown/ }).click()
  await expect(page.getByRole('heading', { name: 'Love Unknown' })).toBeVisible()
  await page.getByRole('button', { name: 'All resources' }).click()

  await page.getByLabel('Search resources').fill('')
  await page.getByRole('button', { name: 'Add resource' }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Title or name').fill('Songs for the Church Year')
  await form.getByLabel('Kind').selectOption('Songbook')
  await form.getByRole('button', { name: 'Add a file' }).click()
  await form.getByLabel('File 1 location').fill('OneDrive/Music/songs-church-year.pdf')
  await form.getByRole('button', { name: 'Save resource' }).click()
  await expect(page.getByRole('heading', { name: 'Songs for the Church Year' })).toBeVisible()
  await expect(page.getByText('OneDrive/Music/songs-church-year.pdf')).toBeVisible()
  await expect(page.getByText('Nothing attached yet')).toBeVisible()
})
