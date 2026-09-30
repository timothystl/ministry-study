import { plainWordText, readWordText } from './wordDoc'

// The LCMS posts its weekly Prayers of the Church, free to use, as one Word file per Sunday. Each series
// has an index page that links every Sunday's file; this finds the ones for a date and reads them.
export const seriesPages = {
  three: 'https://www.lcms.org/worship/three-year-series-prayers',
  one: 'https://www.lcms.org/worship/one-year-series-prayers',
} as const
export type Series = keyof typeof seriesPages
export interface LcmsEntry {
  date: string
  title: string
  url: string
}
export interface LcmsPrayer {
  title: string
  responsive: string
  ektene: string
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const FILE_URL = /^https:\/\/files\.lcms\.org\/dl\/f\/[a-z0-9-]+$/
const decode = (s: string) =>
  s
    .replace(/&rsquo;|&#8217;/g, '’')
    .replace(/&lsquo;|&#8216;/g, '‘')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, '')
    .trim()

// "Sept. 29, 2026" to "2026-09-29".
function isoDate(text: string) {
  const m = /^([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2}),\s*(\d{4})$/.exec(text.trim())
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1
  if (!m || month < 0) return ''
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`
}

export function parseIndex(html: string): LcmsEntry[] {
  const entries: LcmsEntry[] = []
  for (const m of html.matchAll(
    /<li>\s*<strong>([^<]+)<\/strong>[^<]*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/g,
  )) {
    const date = isoDate(decode(m[1]))
    if (date && FILE_URL.test(m[2])) entries.push({ date, url: m[2], title: decode(m[3]) })
  }
  return entries
}

const isDateLine = (line: string) => /^\d{1,2} [A-Za-z]+ \d{4}$/.test(line.trim())
// Splits one file into its Responsive and Ektene forms, without the repeated title and date lines.
export function splitForms(text: string): { responsive: string; ektene: string } {
  const parts = text.split(/^Prayer of the Church\s*[—–-]?\s*\n?\s*(Responsive|Ektene) Form\s*$/im)
  const forms = { responsive: '', ektene: '' }
  // parts: [before, name, body, name, body ...]
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const lines = parts[i + 1].trim().split('\n')
    const skip = lines.findIndex(isDateLine)
    const body = (skip >= 0 && skip < 3 ? lines.slice(skip + 1) : lines).join('\n').trim()
    forms[parts[i].toLowerCase() as 'responsive' | 'ektene'] = body.replace(/\n{2,}/g, '\n\n')
  }
  if (!forms.responsive && !forms.ektene) forms.responsive = text.trim()
  return forms
}

type Get = (url: string) => Promise<Response>
// The prayers for one date (a Sunday can have two, such as a festival), read from the LCMS.
export async function findPrayers(date: string, series: Series, get: Get): Promise<LcmsPrayer[]> {
  const page = await get(seriesPages[series])
  if (!page.ok) throw new Error('The LCMS prayers page could not be reached.')
  const found = parseIndex(await page.text()).filter((e) => e.date === date)
  const prayers: LcmsPrayer[] = []
  for (const entry of found.slice(0, 3)) {
    const file = await get(entry.url)
    if (!file.ok) continue
    const bytes = new Uint8Array(await file.arrayBuffer())
    prayers.push({ title: entry.title, ...splitForms(plainWordText(readWordText(bytes))) })
  }
  return prayers
}
