import { test, expect } from '@playwright/test'
import { nav } from './helpers'

const sermon = `The Lost Sheep Goes Looking
Luke 15:1–7

Some of you came in this morning carrying more than your coat. You came carrying a quiet fear that you are the one who wandered too far.

The shepherd leaves the ninety-nine and goes after the one. Fear says you are too far gone. The shepherd says you are found.

Forgiveness is not a reward for the found; forgiveness is how we were found. Forgiven people forgive, and the cross is where it cost him everything.

So hear it again, for you: your sins are forgiven, and Christ has carried you home. Go in peace.`

test('a sermon file gives the sermon-tied prayer its text, themes and a starting prayer', async ({
  page,
}) => {
  await page.goto('/')
  await nav(page, 'Prayers')
  await page.getByRole('button', { name: 'Load Timothy’s prayers' }).first().click()
  await expect(page.getByText(/Added \d+ prayers\./)).toBeVisible()
  await page.getByRole('button', { name: 'Build the Prayers of the Church' }).click()

  await page.getByLabel('Start from your sermon (Word, text or Markdown)').setInputFiles({
    name: '0042_Lost Sheep.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(sermon),
  })
  const brief = page.getByLabel('Start from a sermon file')
  await expect(brief.getByText('The Lost Sheep Goes Looking')).toBeVisible()
  await expect(brief.getByText('Luke 15:1–7')).toBeVisible()
  await expect(brief.getByText('Forgiveness, Fear')).toBeVisible()

  await page.getByRole('button', { name: 'Start the prayer from Forgiveness' }).click()
  await expect(page.getByLabel('Prayers of the Church preview')).toContainText(
    'SERMON-TIED PETITION\nForgiving God',
  )
})
