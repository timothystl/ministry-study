import { NET_COPYRIGHT, YVP_NOTICE } from '../../worker/bibleSources'
import { ESV_COPYRIGHT } from '../../worker/esv'
import { bookNames, parseReferences, type Reference } from './scripture'

// Bible texts for study: the original languages and English translations, read chapter by chapter
// from the free getBible service. Nothing here is stored in the catalog; the pastor's choice of
// versions is only remembered on this device.
export type Language = 'Hebrew' | 'Greek' | 'English'
export type Testament = 'OT' | 'NT'
export interface Version {
  id: string // getBible abbreviation
  name: string
  short: string
  language: Language
  // Which testament(s) the text contains.
  covers: Testament[]
  rtl?: boolean
  license: string
  // Read through this site's own server (it holds the key), not from getBible.
  viaServer?: boolean
  // Shipped with the site as files under /data/greek, one per book.
  bundled?: boolean
  // Words to show under the page when this version is on screen.
  credit?: string
}
const SBLGNT_CREDIT =
  'SBL Greek New Testament: Michael W. Holmes, ed., The Greek New Testament: SBL Edition (Society of Biblical Literature and Logos Bible Software, 2010), CC BY 4.0.'
const STEP_CREDIT =
  'Data created by www.STEPBible.org based on work at Tyndale House, Cambridge (CC BY 4.0).'
export const versions: Version[] = [
  {
    id: 'codex',
    name: 'Westminster Leningrad Codex',
    short: 'WLC',
    language: 'Hebrew',
    covers: ['OT'],
    rtl: true,
    license: 'Public domain',
  },
  {
    id: 'aleppo',
    name: 'Aleppo Codex',
    short: 'Aleppo',
    language: 'Hebrew',
    covers: ['OT'],
    rtl: true,
    license: 'Public domain',
  },
  {
    id: 'sblgnt',
    name: 'SBL Greek New Testament',
    short: 'SBLGNT',
    language: 'Greek',
    covers: ['NT'],
    license: 'CC BY 4.0',
    bundled: true,
    credit: SBLGNT_CREDIT,
  },
  {
    id: 'thgnt',
    name: 'Tyndale House Greek New Testament (via STEPBible)',
    short: 'Tyndale House',
    language: 'Greek',
    covers: ['NT'],
    license: 'CC BY 4.0',
    bundled: true,
    credit: STEP_CREDIT,
  },
  {
    id: 'na28',
    name: 'Nestle-Aland 28th edition readings (via STEPBible)',
    short: 'NA28',
    language: 'Greek',
    covers: ['NT'],
    license: 'CC BY 4.0',
    bundled: true,
    credit: `${STEP_CREDIT} The NA28 column is the words STEPBible marks as NA28, without the printed edition’s apparatus.`,
  },
  {
    id: 'tischendorf',
    name: 'Tischendorf 8th edition',
    short: 'Tischendorf',
    language: 'Greek',
    covers: ['NT'],
    license: 'Public domain',
  },
  {
    id: 'westcotthort',
    name: 'Westcott–Hort (UBS4 variants)',
    short: 'Westcott–Hort',
    language: 'Greek',
    covers: ['NT'],
    license: 'CC BY-NC-SA 4.0',
  },
  {
    id: 'textusreceptus',
    name: 'Textus Receptus (1550–1894)',
    short: 'Textus Receptus',
    language: 'Greek',
    covers: ['NT'],
    license: 'CC BY-NC-SA 4.0',
  },
  {
    id: 'lxx',
    name: 'Septuagint (LXX, accented)',
    short: 'LXX',
    language: 'Greek',
    covers: ['OT'],
    license: 'Free for non-commercial use',
  },
  {
    id: 'esv',
    name: 'English Standard Version',
    short: 'ESV',
    language: 'English',
    covers: ['OT', 'NT'],
    license: 'Crossway, by permission',
    viaServer: true,
  },
  {
    id: 'net',
    name: 'NET Bible',
    short: 'NET',
    language: 'English',
    covers: ['OT', 'NT'],
    license: 'Biblical Studies Press, by permission',
    viaServer: true,
  },
  {
    id: 'web',
    name: 'World English Bible',
    short: 'WEB',
    language: 'English',
    covers: ['OT', 'NT'],
    license: 'Public domain',
  },
  {
    id: 'kjv',
    name: 'King James Version',
    short: 'KJV',
    language: 'English',
    covers: ['OT', 'NT'],
    license: 'Public domain in the U.S.',
  },
  {
    id: 'asv',
    name: 'American Standard Version',
    short: 'ASV',
    language: 'English',
    covers: ['OT', 'NT'],
    license: 'Public domain',
  },
  {
    id: 'ylt',
    name: 'Young’s Literal Translation',
    short: 'YLT',
    language: 'English',
    covers: ['OT', 'NT'],
    license: 'Public domain',
  },
  {
    id: 'weymouth',
    name: 'Weymouth New Testament',
    short: 'Weymouth',
    language: 'English',
    covers: ['NT'],
    license: 'Public domain',
  },
  {
    id: 'douayrheims',
    name: 'Douay–Rheims',
    short: 'Douay–Rheims',
    language: 'English',
    covers: ['OT', 'NT'],
    license: 'Public domain',
  },
  {
    id: 'tyndale',
    name: 'William Tyndale Bible',
    short: 'Tyndale',
    language: 'English',
    covers: ['OT', 'NT'],
    license: 'Public domain',
  },
]
export { ESV_COPYRIGHT, NET_COPYRIGHT, YVP_NOTICE }
export const languages: Language[] = ['Hebrew', 'Greek', 'English']

export const testamentOf = (book: string): Testament => (bookNames.indexOf(book) < 39 ? 'OT' : 'NT')
export const bookNumber = (book: string) => bookNames.indexOf(book) + 1
// `extra` is the YouVersion Bibles this study's key is licensed for, found when the page opens.
export const versionsFor = (testament: Testament, extra: Version[] = []) =>
  [...versions, ...extra].filter((v) => v.covers.includes(testament))
// The original language of the testament comes first, then an English translation to read beside it.
export const defaultVersionIds = (testament: Testament) =>
  testament === 'OT' ? ['codex', 'web', 'kjv'] : ['sblgnt', 'web', 'kjv']

export interface Verse {
  verse: number
  text: string
}
export interface Passage {
  book: string
  chapter: number
  first: number
  last: number
}
// Turns what was typed into chapters to load and the verses to show in each. A reference without
// a chapter is refused: a whole book is too much to lay side by side.
export function passagesFor(text: string): { passages: Passage[]; error: string } {
  const { refs, complete } = parseReferences(text)
  if (!text.trim()) return { passages: [], error: '' }
  if (!refs.length || !complete)
    return { passages: [], error: 'Type a passage such as John 3:16–21 or Psalm 23.' }
  const passages: Passage[] = []
  for (const r of refs as Reference[]) {
    if (r.start === 0) return { passages: [], error: `Add a chapter, for example ${r.book} 1.` }
    const firstChapter = Math.floor(r.start / 1000)
    const lastChapter = Math.floor(r.end / 1000)
    for (let chapter = firstChapter; chapter <= lastChapter; chapter++)
      passages.push({
        book: r.book,
        chapter,
        first: chapter === firstChapter ? r.start % 1000 || 1 : 1,
        last: chapter === lastChapter ? r.end % 1000 : 999,
      })
  }
  if (passages.length > 12)
    return { passages: [], error: 'That is more than 12 chapters. Try a shorter passage.' }
  return { passages, error: '' }
}

const cache = new Map<string, Promise<Verse[]>>()
const address = (id: string, book: string, chapter: number) =>
  `https://api.getbible.net/v2/${id}/${bookNumber(book)}/${chapter}.json`
// One chapter of one version. A version that lacks the chapter (a different numbering, or a New
// Testament–only text) resolves to an empty list so the other versions still show.
async function loadFromServer(path: string, name: string): Promise<Verse[]> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  })
  if (!(response.headers.get('Content-Type') || '').includes('json'))
    throw new Error(`${name} is only available on the shared study site.`)
  const body = (await response.json()) as { verses?: Verse[]; error?: string }
  if (!response.ok) throw new Error(body.error || `${name} answered ${response.status}.`)
  return body.verses ?? []
}
const chapterQuery = (book: string, chapter: number) =>
  `book=${encodeURIComponent(book)}&chapter=${chapter}`
function loadViaServer(id: string, book: string, chapter: number): Promise<Verse[]> | null {
  if (id === 'esv')
    return loadFromServer(`/api/esv?q=${encodeURIComponent(`${book} ${chapter}`)}`, 'The ESV')
  if (id === 'net')
    return loadFromServer(`/api/net?${chapterQuery(book, chapter)}`, 'The NET Bible')
  if (id.startsWith('yvp:'))
    return loadFromServer(
      `/api/yvp/passage?bible=${encodeURIComponent(id.slice(4))}&${chapterQuery(book, chapter)}`,
      'YouVersion',
    )
  return null
}
// The Bibles YouVersion has enabled for this study's key. Nothing (not an error) when it is not set
// up or the site is running without a server.
export async function loadYvpVersions(): Promise<Version[]> {
  try {
    const response = await fetch('/api/yvp/bibles', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    })
    if (!response.ok || !(response.headers.get('Content-Type') || '').includes('json')) return []
    const body = (await response.json()) as {
      bibles?: { id: string; abbreviation: string; title: string }[]
    }
    return (body.bibles ?? []).map((b) => ({
      id: `yvp:${b.id}`,
      name: b.title,
      short: b.abbreviation,
      language: 'English' as const,
      covers: ['OT', 'NT'] as Testament[],
      license: 'Through YouVersion',
      viaServer: true,
    }))
  } catch {
    return []
  }
}
const books = new Map<string, Promise<Record<string, Record<string, string>>>>()
async function loadBundled(id: string, book: string, chapter: number): Promise<Verse[]> {
  const url = `/data/greek/${id}/${bookNumber(book)}.json`
  let found = books.get(url)
  if (!found) {
    found = (async () => {
      const response = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!(response.headers.get('Content-Type') || '').includes('json')) return {}
      return (await response.json()) as Record<string, Record<string, string>>
    })()
    books.set(url, found)
    found.catch(() => books.delete(url))
  }
  const verses = (await found)[String(chapter)] ?? {}
  return Object.entries(verses)
    .map(([verse, text]) => ({ verse: Number(verse), text }))
    .sort((a, b) => a.verse - b.verse)
}
export function loadChapter(id: string, book: string, chapter: number): Promise<Verse[]> {
  const key = `${id}/${book}/${chapter}`
  let found = cache.get(key)
  if (!found) {
    found = (async () => {
      if (versions.find((v) => v.id === id)?.bundled) return loadBundled(id, book, chapter)
      const served = loadViaServer(id, book, chapter)
      if (served) return served
      const response = await fetch(address(id, book, chapter), {
        headers: { Accept: 'application/json' },
      })
      if (response.status === 404) return []
      if (!response.ok) throw new Error(`The text service answered ${response.status}.`)
      const body = (await response.json()) as { verses?: { verse: number; text: string }[] }
      return (body.verses ?? []).map((v) => ({ verse: v.verse, text: v.text.trim() }))
    })()
    cache.set(key, found)
    // A failure is not remembered, so trying again works.
    found.catch(() => cache.delete(key))
  }
  return found
}
export const clearBibleCache = () => {
  cache.clear()
  books.clear()
}

const CHOICE_KEY = 'ministry-study.bible-versions.v1'
// What was ticked last time, or the defaults. It is not checked against the versions on offer here,
// because the YouVersion ones arrive a moment after the page opens.
export function savedVersionIds(testament: Testament): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(CHOICE_KEY) || '{}') as Record<string, string[]>
    const ids = (all[testament] ?? []).filter((id) => typeof id === 'string')
    return ids.length ? ids : defaultVersionIds(testament)
  } catch {
    return defaultVersionIds(testament)
  }
}
export function saveVersionIds(testament: Testament, ids: string[]) {
  try {
    const all = JSON.parse(localStorage.getItem(CHOICE_KEY) || '{}') as Record<string, string[]>
    localStorage.setItem(CHOICE_KEY, JSON.stringify({ ...all, [testament]: ids }))
  } catch {
    // Only a convenience; the defaults come back next time.
  }
}
