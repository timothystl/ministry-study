import { test, expect } from '@playwright/test'
import { nav } from './helpers'

test('keep an image and a clip, play the clip, and see them on the sermon', async ({ page }) => {
  await page.goto('/')
  await nav(page, 'Images & Clips')
  await expect(page.getByText('Nothing kept yet')).toBeVisible()

  await page.getByRole('button', { name: 'Add image or clip' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/^Kind/).selectOption('Clip')
  await dialog.getByLabel('Title', { exact: true }).fill('Calming the storm')
  await dialog.getByLabel('Link to the image or video').fill('https://youtu.be/dQw4w9WgXcQ')
  await dialog.getByLabel(/^License/).selectOption('CVLI (church license)')
  await dialog.getByLabel('Scripture').fill('Mark 4:35–41')
  await dialog.getByLabel('Starts at').fill('1:05')
  await dialog.getByLabel('Ends at').fill('2:30')
  await dialog.getByLabel('What happens in the clip').fill('The boat is tossed; he sleeps.')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Calming the storm' })).toBeVisible()
  await expect(page.getByText('1:05 to 2:30')).toBeVisible()
  await page.getByRole('button', { name: /Play here from 1:05/ }).click()
  await expect(page.getByTitle('Play Calming the storm')).toHaveAttribute(
    'src',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&start=65&end=150',
  )

  await page.getByRole('button', { name: 'All images and clips' }).click()
  await page.getByLabel('Quick add an image or clip').fill('Lantern in the dark')
  await page.getByLabel('Quick add an image or clip').press('Enter')
  await page.getByRole('button', { name: /Lantern in the dark/ }).click()
  await expect(page.getByRole('note')).toContainText('Not cleared for display')
  await page.getByRole('button', { name: 'All images and clips' }).click()

  await page.getByLabel('Search images and clips').fill('Mark 4:37')
  await expect(page.getByText('Calming the storm')).toBeVisible()
  await expect(page.getByText('Lantern in the dark')).toHaveCount(0)

  await nav(page, 'Sermons')
  await page.getByRole('button', { name: 'Add sermon' }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Title', { exact: true }).fill('Peace, be still')
  await form.getByLabel('Scripture').fill('Mark 4:39')
  await form.getByRole('button', { name: 'Save sermon' }).click()
  await expect(
    page.getByRole('heading', { name: 'Images and clips for this passage' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Calming the storm' })).toBeVisible()
})
