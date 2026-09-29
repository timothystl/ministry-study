import { test, expect } from '@playwright/test'
import { ISBN, barcodeVideo, nav, routes } from './helpers'

test.use({
  permissions: ['camera'],
  launchOptions: {
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${barcodeVideo(ISBN)}`,
    ],
  },
})
test('scanning a barcode with the camera finds the book', async ({ page }) => {
  await routes(page)
  await page.goto('/')
  await nav(page, 'Scan a Book')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Mockingbird Theology' })).toBeVisible({
    timeout: 20_000,
  })
  await expect(dialog.getByText(`ISBN ${ISBN}`)).toBeVisible()
})
