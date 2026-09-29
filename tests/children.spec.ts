import { test, expect } from '@playwright/test'
import { nav } from './helpers'

test('children’s messages have their own page, apart from devotions', async ({ page }) => {
  await page.goto('/')
  await nav(page, 'Children’s Messages')
  await expect(page.getByText('No children’s messages yet')).toBeVisible()
  await page.getByRole('button', { name: 'Add message' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Kind').selectOption('Chapel message')
  await dialog.getByLabel('Title', { exact: true }).fill('The Lost Sheep')
  await dialog.getByLabel('Scripture').fill('Luke 15:1–7')
  await dialog.getByLabel('Text').fill('Hold up a stuffed lamb. Who is missing?')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'The Lost Sheep' })).toBeVisible()
  await page.getByRole('button', { name: 'All messages' }).click()
  await page.getByLabel('Search messages').fill('Luke 15:4')
  await expect(page.getByText('The Lost Sheep')).toBeVisible()

  await nav(page, 'Devotions & Notes')
  await expect(page.getByText('The Lost Sheep')).toHaveCount(0)
})
