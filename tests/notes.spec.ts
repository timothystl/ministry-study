import { test, expect } from '@playwright/test'
import { nav } from './helpers'

test('write a devotion, find it by passage, and see it on the sermon', async ({ page }) => {
  await page.goto('/')
  await nav(page, 'Devotions & Notes')
  await page.getByRole('button', { name: 'Add note' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Title', { exact: true }).fill('Council devotion on the lost son')
  await dialog.getByLabel('Scripture').fill('Luke 15:11–32')
  await dialog.getByLabel('Text').fill('The father runs. Grace is undignified.')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Council devotion on the lost son' }),
  ).toBeVisible()

  await nav(page, 'Sermons')
  await page.getByRole('button', { name: 'Add sermon' }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Title', { exact: true }).fill('The Lost Son')
  await form.getByLabel('Scripture').fill('Luke 15:20')
  await form.getByRole('button', { name: 'Save sermon' }).click()
  await expect(page.getByText('Council devotion on the lost son')).toBeVisible()
  await expect(page.getByText('Same passage')).toBeVisible()

  await page.getByRole('button', { name: 'Add a note' }).click()
  await page.getByRole('dialog').getByLabel('Text').fill('Open with the running father.')
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open with the running father.' })).toBeVisible()
})
