import { test, expect } from '@playwright/test'
import { nav } from './helpers'

test('the storage readout shows documents, images and video, and the biggest files', async ({
  page,
}) => {
  await page.route('**/api/usage', (route) =>
    route.fulfill({
      json: {
        files: [
          { id: 'aaaaaaaa1', name: 'hymnal.pdf', mime: 'application/pdf', size: 5_000_000 },
          { id: 'bbbbbbbb2', name: 'lantern.jpg', mime: 'image/jpeg', size: 700_000 },
        ],
        filesTruncated: false,
        records: { count: 12, bytes: 40_000 },
        manuscripts: { count: 2, bytes: 90_000 },
      },
    }),
  )
  await page.goto('/')
  await nav(page, 'Library Data')
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Check storage' }).click()
  await expect(dialog.getByText('1 document · 1 image · 0 videos')).toBeVisible()
  await expect(dialog.getByText('5.8 MB')).toBeVisible()
  await expect(dialog.getByText('hymnal.pdf')).toBeVisible()
  await expect(dialog.getByText('Not attached to anything').first()).toBeVisible()
})

test('the storage readout explains itself when the shared library is not reachable', async ({
  page,
}) => {
  await page.route('**/api/usage', (route) => route.fulfill({ status: 404, json: {} }))
  await page.goto('/')
  await nav(page, 'Library Data')
  await page.getByRole('dialog').getByRole('button', { name: 'Check storage' }).click()
  await expect(page.getByRole('alert')).toContainText('shared library')
})
