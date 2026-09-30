// More Bible text for the Bible Study page, read through the Worker so keys stay on the server:
// the NET Bible (from bible.org's free service) and whichever Bibles the study's YouVersion Platform
// key has been licensed for.
export const NET_COPYRIGHT =
  'Scripture quoted by permission. Quotations designated (NET) are from the NET Bible® copyright ©1996–2017 by Biblical Studies Press, L.L.C. www.bible.org. All rights reserved.'
export const YVP_NOTICE =
  'Bible text provided through YouVersion. Each translation’s copyright belongs to its publisher.'

// USFM book codes in canonical order; the names are the ones the scripture reader uses.
const BOOKS: [string, string][] = [
  ['Genesis', 'GEN'],
  ['Exodus', 'EXO'],
  ['Leviticus', 'LEV'],
  ['Numbers', 'NUM'],
  ['Deuteronomy', 'DEU'],
  ['Joshua', 'JOS'],
  ['Judges', 'JDG'],
  ['Ruth', 'RUT'],
  ['1 Samuel', '1SA'],
  ['2 Samuel', '2SA'],
  ['1 Kings', '1KI'],
  ['2 Kings', '2KI'],
  ['1 Chronicles', '1CH'],
  ['2 Chronicles', '2CH'],
  ['Ezra', 'EZR'],
  ['Nehemiah', 'NEH'],
  ['Esther', 'EST'],
  ['Job', 'JOB'],
  ['Psalms', 'PSA'],
  ['Proverbs', 'PRO'],
  ['Ecclesiastes', 'ECC'],
  ['Song of Solomon', 'SNG'],
  ['Isaiah', 'ISA'],
  ['Jeremiah', 'JER'],
  ['Lamentations', 'LAM'],
  ['Ezekiel', 'EZK'],
  ['Daniel', 'DAN'],
  ['Hosea', 'HOS'],
  ['Joel', 'JOL'],
  ['Amos', 'AMO'],
  ['Obadiah', 'OBA'],
  ['Jonah', 'JON'],
  ['Micah', 'MIC'],
  ['Nahum', 'NAM'],
  ['Habakkuk', 'HAB'],
  ['Zephaniah', 'ZEP'],
  ['Haggai', 'HAG'],
  ['Zechariah', 'ZEC'],
  ['Malachi', 'MAL'],
  ['Matthew', 'MAT'],
  ['Mark', 'MRK'],
  ['Luke', 'LUK'],
  ['John', 'JHN'],
  ['Acts', 'ACT'],
  ['Romans', 'ROM'],
  ['1 Corinthians', '1CO'],
  ['2 Corinthians', '2CO'],
  ['Galatians', 'GAL'],
  ['Ephesians', 'EPH'],
  ['Philippians', 'PHP'],
  ['Colossians', 'COL'],
  ['1 Thessalonians', '1TH'],
  ['2 Thessalonians', '2TH'],
  ['1 Timothy', '1TI'],
  ['2 Timothy', '2TI'],
  ['Titus', 'TIT'],
  ['Philemon', 'PHM'],
  ['Hebrews', 'HEB'],
  ['James', 'JAS'],
  ['1 Peter', '1PE'],
  ['2 Peter', '2PE'],
  ['1 John', '1JN'],
  ['2 John', '2JN'],
  ['3 John', '3JN'],
  ['Jude', 'JUD'],
  ['Revelation', 'REV'],
]
export const bookOrder = BOOKS.map(([name]) => name)
const USFM = new Map(BOOKS)
export const validChapter = (book: string, chapter: string) =>
  USFM.has(book) && /^\d{1,3}$/.test(chapter) && Number(chapter) >= 1
export const validBibleId = (id: string) => /^\d{1,7}$/.test(id)

export interface ChapterVerse {
  verse: number
  text: string
}
const entities: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&mdash;': '—',
  '&ndash;': '–',
}
const plain = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&[a-z]+;|&#39;/gi, (e) => entities[e.toLowerCase()] ?? e)
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?’”])/g, '$1')
    .trim()

// ---- NET Bible ----
export async function fetchNetChapter(
  book: string,
  chapter: string,
  fetcher: typeof fetch = fetch,
): Promise<ChapterVerse[]> {
  const url = `https://labs.bible.org/api/?passage=${encodeURIComponent(`${book} ${chapter}`)}&type=json&formatting=plain`
  const response = await fetcher(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`The NET Bible service answered ${response.status}.`)
  const rows = (await response.json()) as { verse?: string | number; text?: string }[]
  return rows
    .filter((r) => r.verse !== undefined && r.text)
    .map((r) => ({ verse: Number(r.verse), text: plain(String(r.text)) }))
}

// ---- YouVersion Platform ----
const YVP = 'https://api.youversion.com'
const headers = (key: string) => ({ 'X-YVP-App-Key': key, Accept: 'application/json' })
export interface YvpBible {
  id: string
  abbreviation: string
  title: string
}
// The Bibles this key has been enabled for (English ones), not the whole catalog.
export async function listYvpBibles(
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<YvpBible[]> {
  const found: YvpBible[] = []
  let token = ''
  for (let page = 0; page < 5; page++) {
    const url = `${YVP}/v1/bibles?language_ranges[]=eng${token ? `&page_token=${encodeURIComponent(token)}` : ''}`
    const response = await fetcher(url, { headers: headers(key) })
    if (!response.ok) throw new Error(`YouVersion answered ${response.status}.`)
    const body = (await response.json()) as {
      data?: { id?: number | string; abbreviation?: string; title?: string }[]
      next_page_token?: string
    }
    for (const b of body.data ?? [])
      if (b.id !== undefined)
        found.push({
          id: String(b.id),
          abbreviation: b.abbreviation || String(b.id),
          title: b.title || b.abbreviation || String(b.id),
        })
    token = body.next_page_token || ''
    if (!token) break
  }
  return found
}
// Verse numbers arrive as markup that differs between publishers; these are the shapes seen so
// far. A chapter with no recognizable numbers is an error, so it shows up instead of a wrong table.
const MARK =
  /<span[^>]*class="[^"]*yv-vlbl[^"]*"[^>]*>\s*(\d+)[^<]*<\/span>|<span[^>]*\bv="(\d+)"[^>]*>|<sup[^>]*>\s*(\d+)\s*<\/sup>/g
export function parseYvpVerses(html: string): ChapterVerse[] {
  const marks = [...html.matchAll(MARK)]
  if (!marks.length) throw new Error('YouVersion sent text without verse numbers.')
  const verses = new Map<number, string>()
  marks.forEach((m, i) => {
    const number = Number(m[1] ?? m[2] ?? m[3])
    const end = i + 1 < marks.length ? marks[i + 1].index : html.length
    const text = plain(html.slice(m.index + m[0].length, end))
    if (text) verses.set(number, `${verses.get(number) ?? ''} ${text}`.trim())
  })
  return [...verses].map(([verse, text]) => ({ verse, text }))
}
export async function fetchYvpChapter(
  key: string,
  bibleId: string,
  book: string,
  chapter: string,
  fetcher: typeof fetch = fetch,
): Promise<ChapterVerse[]> {
  const url = `${YVP}/v1/bibles/${bibleId}/passages/${USFM.get(book)}.${chapter}?format=html`
  const response = await fetcher(url, { headers: headers(key) })
  if (response.status === 404) return []
  if (!response.ok) throw new Error(`YouVersion answered ${response.status}.`)
  const body = (await response.json()) as { content?: string }
  return body.content ? parseYvpVerses(body.content) : []
}
