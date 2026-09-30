import { test, expect } from '@playwright/test'
import { nav } from './helpers'

test('add a resource as it is used, with a copy kept in local files', async ({ page }) => {
  await page.goto('/')
  await nav(page, 'Music Resources')
  await expect(page.getByText('No resources yet')).toBeVisible()

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
