import { test, expect } from '@playwright/test'
import { nav } from './helpers'

// Invented prayers in the shape of the builder file.
const FILE = `const LIBRARY = [{"id":"sick","name":"The Sick","description":"For the ill","prayers":[{"id":"sick_1","name":"Option A — First","text":"O God, we name [names] who are ill. Lord, in your mercy,"},{"id":"sick_2","name":"Option B — Second","text":"O God, hold the weary. Lord, in your mercy,"}]},{"id":"school","name":"Schools","description":"For the school","prayers":[{"id":"school_1","name":"Option A — Desks","text":"O God, bless the teachers. Lord, in your mercy,"}]}];
const STARTERS = {
  grace: "God of grace, we heard it again. Lord, in your mercy,",
};
`
test('import prayers, build the prayers of the church, and save the service', async ({ page }) => {
  await page.goto('/')
  await nav(page, 'Prayers')
  await expect(page.getByText('No prayers yet')).toBeVisible()
  await page.getByRole('button', { name: 'Import prayers' }).click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByLabel('Choose prayer file')
    .setInputFiles({ name: 'prayers.tsx', mimeType: 'text/plain', buffer: Buffer.from(FILE) })
  await expect(
    dialog.getByText('2 categories and 1 sermon starters found: 4 prayers to add'),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Import 4 prayers' }).click()
  await expect(page.getByText('4 prayers · 0 saved services')).toBeVisible()

  await page.getByLabel('Search prayers').fill('weary')
  await expect(page.getByText('Option B — Second')).toBeVisible()
  await expect(page.getByText('Option A — First')).toHaveCount(0)
  await page.getByLabel('Search prayers').fill('')

  await page.getByRole('button', { name: 'Build the Prayers of the Church' }).click()
  await page.getByLabel('Sunday or occasion').fill('Proper 21')
  await page.getByLabel('Names of the sick').fill('Ann and Bob')
  await page.locator('summary', { hasText: 'The Sick' }).click()
  await page.getByRole('checkbox', { name: /Option A — First/ }).check()
  await page.getByLabel('Start from a sermon theme').selectOption({ label: 'Grace' })
  const preview = page.getByLabel('Prayers of the Church preview')
  await expect(preview).toContainText('PROPER 21')
  await expect(preview).toContainText(
    'THE SICK\nO God, we name Ann and Bob who are ill.\nLord, in your mercy,\nHear our prayer.',
  )
  await expect(preview).toContainText(
    'SERMON-TIED PETITION\nGod of grace, we heard it again.\nLord, in your mercy,',
  )
  expect((await preview.innerText()).match(/Lord, in your mercy,/g)).toHaveLength(2)

  await page.getByRole('button', { name: 'Save this service' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()
  await page.getByRole('button', { name: 'Saved services' }).click()
  await expect(page.getByText('Proper 21')).toBeVisible()
  await page.getByRole('button', { name: 'Open to reuse' }).click()
  // Names were not kept in the saved copy, so the placeholder is back when the service is reused.
  await expect(page.getByLabel('Names of the sick')).toHaveValue('')
  await expect(page.getByLabel('Prayers of the Church preview')).toContainText(
    'we name [names] who are ill',
  )

  await page.reload()
  await nav(page, 'Prayers')
  await expect(page.getByText('4 prayers · 1 saved services')).toBeVisible()
})

test('a new library can build the prayers right away, with the LCMS prayer and an email', async ({
  page,
}) => {
  await page.goto('/')
  await nav(page, 'Prayers')
  await page.getByRole('button', { name: 'Build the Prayers of the Church' }).click()
  await page.getByRole('button', { name: 'Or load a small starter set' }).click()
  await page.getByRole('button', { name: 'Choose the first bidding in every category' }).click()
  await page.getByLabel('Names of the sick').fill('Ann')
  await page.route('**/api/lcms-prayer*', (route) =>
    route.fulfill({
      json: {
        prayers: [
          {
            title: 'Third Sunday of Testing',
            responsive:
              'Gracious Lord, keep us. [especially _____________]. Lord, in Your mercy, hear our prayer.',
            ektene: 'In peace, let us pray to the Lord: Lord, have mercy.',
          },
        ],
      },
    }),
  )
  await page.getByRole('button', { name: 'Get this Sunday’s LCMS prayer' }).click()
  await expect(page.getByText('From the LCMS: Third Sunday of Testing.')).toBeVisible()
  const preview = page.getByLabel('Prayers of the Church preview')
  await expect(preview).toContainText('be near Ann and all who are ill')
  await expect(preview).toContainText(
    'LCMS PRAYER OF THE CHURCH\nGracious Lord, keep us. especially Ann.',
  )
  await page.getByLabel('Form').selectOption('ektene')
  await expect(preview).toContainText('In peace, let us pray to the Lord')
  await expect(page.getByRole('link', { name: /Three-Year Series/ })).toHaveAttribute(
    'href',
    'https://www.lcms.org/worship/three-year-series-prayers',
  )
  await expect(page.getByRole('button', { name: 'Email these prayers' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Print or save as PDF/ })).toBeVisible()
})

test("Load Timothy's prayers fills the library and the builder", async ({ page }) => {
  await page.goto('/')
  await nav(page, 'Prayers')
  await page.getByRole('button', { name: 'Load Timothy’s prayers' }).first().click()
  await expect(page.getByText('Added 112 prayers.')).toBeVisible()
  await expect(page.getByText('112 prayers · 0 saved services')).toBeVisible()
  await page.getByLabel('Search prayers').fill('waiting rooms')
  await expect(page.getByText('Option F — Father of compassion')).toBeVisible()
  await page.getByLabel('Search prayers').fill('')

  await page.getByRole('button', { name: 'Build the Prayers of the Church' }).click()
  await page.getByLabel('Names of the sick').fill('Ann')
  await page.locator('summary', { hasText: 'The Sick and Suffering' }).click()
  await page.getByRole('checkbox', { name: /Option A — Healer of bodies/ }).check()
  await page.getByLabel('Start from a sermon theme').selectOption({ label: 'Grace' })
  const preview = page.getByLabel('Prayers of the Church preview')
  await expect(preview).toContainText('We name Ann who carry burdens')
  await expect(preview).toContainText('SERMON-TIED PETITION\nGod of grace')
})
