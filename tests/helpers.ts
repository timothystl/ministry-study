import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, type Page } from '@playwright/test'

export const ISBN = '9780061551826'
// An EAN-13 barcode drawn into a video file, so the camera path is tested with a real decode.
const L = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
]
const R = L.map((c) => [...c].map((b) => (b === '1' ? '0' : '1')).join(''))
const G = R.map((c) => [...c].reverse().join(''))
const PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
]
function ean13Bits(code: string) {
  const d = [...code].map(Number)
  const left = PARITY[d[0]]
    .split('')
    .map((p, i) => (p === 'L' ? L : G)[d[i + 1]])
    .join('')
  const right = d
    .slice(7)
    .map((n) => R[n])
    .join('')
  return `101${left}01010${right}101`
}
export function barcodeVideo(code: string) {
  const [w, h, module] = [640, 480, 5]
  const bits = ean13Bits(code)
  const y = Buffer.alloc(w * h, 255)
  const x0 = Math.floor((w - bits.length * module) / 2)
  for (let row = 100; row < 380; row++)
    for (let i = 0; i < bits.length; i++)
      if (bits[i] === '1') y.fill(0, row * w + x0 + i * module, row * w + x0 + (i + 1) * module)
  const chroma = Buffer.alloc((w / 2) * (h / 2), 128)
  const frame = Buffer.concat([Buffer.from('FRAME\n'), y, chroma, chroma])
  const header = Buffer.from(`YUV4MPEG2 W${w} H${h} F10:1 Ip A1:1 C420jpeg\n`)
  const dir = join(tmpdir(), 'ministry-study-tests')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `barcode-${code}.y4m`)
  writeFileSync(file, Buffer.concat([header, ...Array.from({ length: 6 }, () => frame)]))
  return file
}
export async function routes(page: Page) {
  await page.route('https://openlibrary.org/isbn/*.json', (route) =>
    route.fulfill({
      json: {
        title: 'Mockingbird Theology',
        publishers: ['HarperOne'],
        publish_date: '2008',
        covers: [1234],
        works: [{ key: '/works/OL1W' }],
      },
    }),
  )
  await page.route('https://openlibrary.org/search.json?*', (route) =>
    route.fulfill({
      json: {
        docs: [{ key: '/works/OL1W', title: 'Mockingbird Theology', author_name: ['Test Author'] }],
      },
    }),
  )
  await page.route('https://openlibrary.org/works/OL1W.json', (route) =>
    route.fulfill({ json: { description: 'Resurrection and the mission of the church.' } }),
  )
  await page.route('https://www.googleapis.com/**', (route) =>
    route.fulfill({ status: 404, body: '{}' }),
  )
  await page.route('https://covers.openlibrary.org/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="150"><rect width="100" height="150" fill="#164957"/></svg>',
    }),
  )
}
export async function nav(page: Page, name: string) {
  const opener = page.getByRole('button', { name: 'Open navigation', exact: true })
  if (await opener.isVisible()) await opener.click()
  await page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('button', { name, exact: true })
    .click()
}
export async function addBook(page: Page, title: string, author: string) {
  await nav(page, 'Add Book')
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Title', { exact: true }).fill(title)
  await dialog.getByLabel('Author / contributors').fill(author)
  await dialog.getByRole('button', { name: 'Save book' }).click()
  await expect(page.locator('.book-detail')).toBeVisible()
}
