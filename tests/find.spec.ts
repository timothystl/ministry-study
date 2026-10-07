import { test, expect } from '@playwright/test'
import { nav } from './helpers'

test('search everything finds a sermon, opens it, and points outside', async ({ page }) => {
  await page.goto('/')
  await nav(page, 'Sermons')
  await page.getByRole('button', { name: 'Add sermon' }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Title', { exact: true }).fill('Forgiveness and reconciliation')
  await form.getByLabel('Scripture').fill('Matthew 18:21–35')
  await form.getByRole('button', { name: 'Save sermon' }).click()

  await nav(page, 'Find Anything')
  await page.getByLabel('Search everything', { exact: true }).fill('forgiveness')
  await page
    .getByRole('region', { name: 'What are you working on' })
    .getByRole('button', { name: 'Search', exact: true })
    .click()
  await expect(page.getByText('Forgiveness and reconciliation')).toBeVisible()
  await expect(page.getByRole('link', { name: /Search hymns/ })).toBeVisible()

  await page.getByRole('button', { name: 'My resources' }).click()
  await expect(page.getByRole('link', { name: /Search hymns/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Open sermon' }).click()
  await expect(page.getByRole('heading', { name: 'Sermons' }).first()).toBeVisible()
  await expect(page.getByText('Forgiveness and reconciliation').first()).toBeVisible()

  await nav(page, 'Find Anything')
  await page.getByLabel('Search everything', { exact: true }).fill('Luke 15:1–7')
  await page
    .getByRole('region', { name: 'What are you working on' })
    .getByRole('button', { name: 'Search', exact: true })
    .click()
  await page.getByRole('button', { name: 'Open passage' }).click()
  await expect(page.getByRole('heading', { name: 'Research a Text' })).toBeVisible()
})
