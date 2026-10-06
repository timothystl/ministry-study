import { test, expect } from '@playwright/test'
import { nav } from './helpers'

test('research a text: see what you have on it and keep sermon and class notes', async ({
  page,
}) => {
  await page.goto('/')
  await nav(page, 'Sermons')
  await page.getByRole('button', { name: 'Add sermon' }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Title', { exact: true }).fill('The Lost Sheep Sunday')
  await form.getByLabel('Scripture').fill('Luke 15:4–6')
  await form.getByRole('button', { name: 'Save sermon' }).click()

  await nav(page, 'Research a Text')
  await page.getByLabel('Passage').fill('Luke 15:1–7')
  await page.getByRole('button', { name: 'Open passage' }).click()

  await page.getByLabel('Notes', { exact: true }).fill('The shepherd leaves the ninety-nine.')
  await page.getByLabel('Bible class notes').check()
  await page.getByRole('button', { name: 'Save notes' }).click()
  await expect(page.getByRole('button', { name: 'Bible class notes on Luke 15:1–7' })).toBeVisible()

  await page.getByRole('tab', { name: 'My material' }).click()
  await expect(
    page.getByRole('tabpanel', { name: 'My material' }).getByText('The Lost Sheep Sunday'),
  ).toBeVisible()
  await page.getByRole('tab', { name: 'Commentary' }).click()
  await expect(page.getByText('No commentary in your library')).toBeVisible()
})
