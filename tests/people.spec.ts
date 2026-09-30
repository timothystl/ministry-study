import { test, expect, type Page } from '@playwright/test'
import { nav } from './helpers'

const sections = [
  { key: 'library', label: 'Library', detail: 'Books' },
  { key: 'sermons', label: 'Sermons', detail: 'Sermons' },
  { key: 'prayers', label: 'Prayers', detail: 'Prayers' },
  { key: 'notes', label: 'Devotions & Notes', detail: 'Notes' },
  { key: 'children', label: 'Children’s Messages', detail: 'Kids' },
]
const me =
  (body: object, status = 200) =>
  (page: Page) =>
    page.route('**/api/me', (route) => route.fulfill({ status, json: body }))

test('a person with only Prayers and Children’s Messages sees only those parts', async ({
  page,
}) => {
  await me({
    email: 'guest@example.org',
    name: 'Guest',
    role: 'user',
    sections: ['prayers', 'children'],
    sectionList: sections,
  })(page)
  await page.goto('/')
  const opener = page.getByRole('button', { name: 'Open navigation', exact: true })
  // Wait for the page to finish starting: the menu button on a phone, the menu itself on a desktop.
  await opener
    .or(page.getByRole('navigation', { name: 'Main navigation', exact: true }))
    .first()
    .waitFor()
  if (await opener.isVisible()) await opener.click()
  const menu = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(menu.getByRole('button', { name: 'Prayers' })).toHaveCount(1)
  await expect(menu.getByRole('button', { name: 'Children’s Messages' })).toHaveCount(1)
  for (const hidden of ['Search', 'Sermons', 'Devotions & Notes', 'Loans', 'Add Book', 'People'])
    await expect(menu.getByRole('button', { name: hidden })).toHaveCount(0)
  // Opens on the first part they have, and starts with an empty library, not the samples.
  await expect(page.getByRole('heading', { name: 'Prayers', level: 1 })).toBeVisible()
  await expect(page.getByText('Illustrative sample')).toHaveCount(0)
})

test('someone who has not been added is told so', async ({ page }) => {
  await me({ error: 'no', reason: 'not-added', email: 'stranger@example.org' }, 403)(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Not added yet' })).toBeVisible()
  await expect(page.getByText('stranger@example.org')).toBeVisible()
})

test('the pastor adds a person and turns parts on and off', async ({ page }) => {
  let people: object[] = []
  await me({
    email: 'pastor@example.org',
    name: 'Andrew',
    role: 'admin',
    sections: sections.map((s) => s.key),
    sectionList: sections,
  })(page)
  await page.route('**/api/people**', async (route) => {
    const request = route.request()
    if (request.method() === 'PUT') {
      const email = decodeURIComponent(new URL(request.url()).pathname.split('/').pop()!)
      const body = request.postDataJSON()
      people = [
        ...people.filter((p) => (p as { email: string }).email !== email),
        { email, ...body },
      ]
    }
    await route.fulfill({ json: { people } })
  })
  await page.goto('/')
  await nav(page, 'People')
  await expect(page.getByRole('heading', { name: 'People', level: 1 })).toBeVisible()
  const form = page.getByRole('form', { name: 'Add a person' })
  await form.getByLabel('Name').fill('Sam Helper')
  await form.getByLabel(/Email/).fill('Sam@Example.org')
  await form.getByLabel(/Children/).check()
  await form.getByRole('button', { name: 'Add person' }).click()
  const card = page.getByRole('listitem').filter({ hasText: 'sam@example.org' })
  await expect(card).toBeVisible()
  await expect(card.getByLabel(/Children/)).toBeChecked()
  await expect(card.getByLabel(/Sermons/)).not.toBeChecked()
  await card.getByLabel(/Sermons/).check()
  await expect.poll(() => JSON.stringify(people)).toContain('sermons')
  await card.getByRole('button', { name: 'Pause access' }).click()
  await expect(card.getByText('Access paused')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Restore access' })).toBeVisible()
})
