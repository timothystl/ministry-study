// Scripture references: recognize "Luke 15:1–10", "1 Cor 13", "Ps 23; John 10:11" and compare
// them by overlap, so a search for Luke 15 finds a sermon on Luke 15:11–32.
const books: [string, string[]][] = [
  ['Genesis', ['gen', 'ge', 'gn']],
  ['Exodus', ['exod', 'exo', 'ex']],
  ['Leviticus', ['lev', 'le', 'lv']],
  ['Numbers', ['num', 'nu', 'nm', 'nb']],
  ['Deuteronomy', ['deut', 'dt', 'de']],
  ['Joshua', ['josh', 'jos']],
  ['Judges', ['judg', 'jdg', 'jg']],
  ['Ruth', ['ru']],
  ['1 Samuel', ['1 sam', '1 sa', '1 sm']],
  ['2 Samuel', ['2 sam', '2 sa', '2 sm']],
  ['1 Kings', ['1 kgs', '1 ki', '1 kin']],
  ['2 Kings', ['2 kgs', '2 ki', '2 kin']],
  ['1 Chronicles', ['1 chron', '1 chr', '1 ch']],
  ['2 Chronicles', ['2 chron', '2 chr', '2 ch']],
  ['Ezra', ['ezr']],
  ['Nehemiah', ['neh', 'ne']],
  ['Esther', ['esth', 'est']],
  ['Job', ['jb']],
  ['Psalms', ['psalm', 'ps', 'psa', 'pss']],
  ['Proverbs', ['prov', 'pro', 'prv', 'pr']],
  ['Ecclesiastes', ['eccles', 'eccl', 'ecc', 'qoh']],
  ['Song of Solomon', ['song of songs', 'song', 'sos', 'ss']],
  ['Isaiah', ['isai', 'isa', 'is']],
  ['Jeremiah', ['jer', 'je']],
  ['Lamentations', ['lam', 'la']],
  ['Ezekiel', ['ezek', 'eze', 'ezk']],
  ['Daniel', ['dan', 'da', 'dn']],
  ['Hosea', ['hos', 'ho']],
  ['Joel', ['jl']],
  ['Amos', ['am']],
  ['Obadiah', ['obad', 'ob']],
  ['Jonah', ['jon', 'jnh']],
  ['Micah', ['mic', 'mc']],
  ['Nahum', ['nah', 'na']],
  ['Habakkuk', ['hab', 'hb']],
  ['Zephaniah', ['zeph', 'zep', 'zp']],
  ['Haggai', ['hag', 'hg']],
  ['Zechariah', ['zech', 'zec', 'zc']],
  ['Malachi', ['mal', 'ml']],
  ['Matthew', ['matt', 'mat', 'mt']],
  ['Mark', ['mrk', 'mk', 'mr']],
  ['Luke', ['luk', 'lk']],
  ['John', ['jn', 'jhn']],
  ['Acts', ['act', 'ac']],
  ['Romans', ['rom', 'ro', 'rm']],
  ['1 Corinthians', ['1 cor', '1 co']],
  ['2 Corinthians', ['2 cor', '2 co']],
  ['Galatians', ['gal', 'ga']],
  ['Ephesians', ['eph', 'ep']],
  ['Philippians', ['phil', 'php', 'pp']],
  ['Colossians', ['col', 'co']],
  ['1 Thessalonians', ['1 thess', '1 thes', '1 th']],
  ['2 Thessalonians', ['2 thess', '2 thes', '2 th']],
  ['1 Timothy', ['1 tim', '1 ti']],
  ['2 Timothy', ['2 tim', '2 ti']],
  ['Titus', ['tit', 'ti']],
  ['Philemon', ['philem', 'phm', 'pm']],
  ['Hebrews', ['heb']],
  ['James', ['jas', 'jm']],
  ['1 Peter', ['1 pet', '1 pe', '1 pt']],
  ['2 Peter', ['2 pet', '2 pe', '2 pt']],
  ['1 John', ['1 jn', '1 jhn', '1 jo']],
  ['2 John', ['2 jn', '2 jhn', '2 jo']],
  ['3 John', ['3 jn', '3 jhn', '3 jo']],
  ['Jude', ['jud']],
  ['Revelation', ['revelation of john', 'rev', 're', 'rv']],
]
export const bookNames = books.map(([name]) => name)
const lookup = new Map<string, { book: string; canonical: boolean }>()
for (const [name, aliases] of books) {
  lookup.set(name.toLowerCase(), { book: name, canonical: true })
  for (const alias of aliases)
    if (!lookup.has(alias)) lookup.set(alias, { book: name, canonical: false })
}
// "Psalm" is also a fine whole-book word; short abbreviations only count when a chapter follows.
const wholeBookOk = (key: string) =>
  lookup.get(key)!.canonical || key.replace(/^\d /, '').length >= (/^\d /.test(key) ? 3 : 4)

export interface Reference {
  book: string
  start: number // chapter * 1000 + verse
  end: number
}
export const referenceText = (r: Reference) => r.book
function normalizeBook(text: string) {
  return text
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(iii|3rd|third)\b ?/, '3 ')
    .replace(/^(ii|2nd|second)\b ?/, '2 ')
    .replace(/^(i|1st|first)\b (?=[a-z])/, '1 ')
    .replace(/^(\d)(?=[a-z])/, '$1 ')
}
// Accepts the ways sermons are filed: "Matt 13.24-30", "Matt 18v1-6,19v13-15", "Matt 27.11-14
// 24-26", "Matt 5.1-12 Num 6", as well as "Matt 13:24–30". Everything is rewritten to one form
// (chapter:verse, semicolons between books) before reading.
// "1 Cor" and "I John" are glued to their numeral (1_Cor) so the numeral is not read as a verse.
function protect(text: string) {
  return text.replace(
    /\b(1st|2nd|3rd|first|second|third|iii|ii|i|[1-3])\.?\s+([a-z]+)/gi,
    (all, n: string, word: string) => {
      const digit = {
        1: '1',
        i: '1',
        first: '1',
        '1st': '1',
        2: '2',
        ii: '2',
        second: '2',
        '2nd': '2',
        3: '3',
        iii: '3',
        third: '3',
        '3rd': '3',
      }[n.toLowerCase() as '1']
      return lookup.has(normalizeBook(`${digit} ${word}`)) ? `${digit}_${word}` : all
    },
  )
}
function tidy(text: string) {
  return protect(text.replace(/[–—]/g, '-'))
    .replace(/(\d)\s*v\s*(?=\d)/gi, '$1:')
    .replace(/(\d)\.(?=\d)/g, '$1:')
    .replace(/,\s*(?=(?:[1-3]_)?[a-z]{2,})/gi, '; ')
    .replace(/(\d)\s+(?=(?:[1-3]_)?[a-z]{2,})/gi, '$1; ')
    .replace(/(\d)\s+(?=\d)/g, '$1,')
    .replace(/_/g, ' ')
}
const num2 = (chapter: number, verse = 0) => chapter * 1000 + verse
const item = /^(\d+)(?:\s*:\s*(\d+))?(?:\s*-\s*(?:(\d+)\s*:\s*)?(\d+))?$/

// Reads the chapter and verse list that follows a book name. Returns null if any piece is
// unreadable.
function readList(book: string, rest: string): Reference[] | null {
  const refs: Reference[] = []
  let chapter = 0
  let inVerses = false
  for (const raw of rest.split(',')) {
    const m = item.exec(raw.trim())
    if (!m) return null
    const [, a, b, c2, e] = m
    if (b !== undefined) {
      chapter = Number(a)
      const first = num2(chapter, Number(b))
      const last = e ? (c2 ? num2(Number(c2), Number(e)) : num2(chapter, Number(e))) : first
      if (c2) chapter = Number(c2)
      refs.push({ book, start: first, end: Math.max(first, last) })
      inVerses = true
    } else if (inVerses) {
      const first = num2(chapter, Number(a))
      const last = e ? num2(chapter, Number(e)) : first
      refs.push({ book, start: first, end: Math.max(first, last) })
    } else {
      chapter = Number(a)
      const last = e ? Number(e) : chapter
      refs.push({ book, start: num2(chapter), end: num2(Math.max(chapter, last), 999) })
    }
  }
  return refs
}

// Reads references separated by semicolons. `complete` is false when other text is mixed in, so a
// search like "grace" is not mistaken for a reference.
export function parseReferences(text: string): { refs: Reference[]; complete: boolean } {
  const refs: Reference[] = []
  let previous = ''
  let complete = true
  const parts = tidy(text)
    .split(/;|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return { refs, complete: false }
  const named =
    /^((?:[1-3]|i{1,3}|1st|2nd|3rd|first|second|third)\.?\s*)?([a-z]+(?:\s+of\s+(?:solomon|songs|john))?)\.?\s*(.*)$/i
  for (const part of parts) {
    let book = ''
    let rest = ''
    const m = named.exec(part)
    if (m) {
      const key = normalizeBook(`${m[1] || ''}${m[2]}`)
      const entry = lookup.get(key)
      if (entry && (m[3] || wholeBookOk(key))) {
        book = entry.book
        rest = m[3]
      }
    }
    if (!book && previous && /^\d/.test(part)) {
      book = previous
      rest = part
    }
    if (!book) {
      complete = false
      continue
    }
    previous = book
    if (!rest.trim()) {
      refs.push({ book, start: 0, end: num2(999, 999) })
      continue
    }
    const list = readList(book, rest)
    if (!list) {
      complete = false
      continue
    }
    refs.push(...list)
  }
  return { refs, complete: complete && refs.length > 0 }
}
const en = '–'
// One consistent way to write references, for catalogs imported from many filing styles.
export function formatReferences(refs: Reference[]) {
  return refs
    .map((r) => {
      if (r.start === 0 && r.end === num2(999, 999)) return r.book
      const [c1, v1] = [Math.floor(r.start / 1000), r.start % 1000]
      const [c2, v2] = [Math.floor(r.end / 1000), r.end % 1000]
      const whole = v1 === 0 && v2 === 999
      if (whole) return c1 === c2 ? `${r.book} ${c1}` : `${r.book} ${c1}${en}${c2}`
      if (c1 === c2) return v1 === v2 ? `${r.book} ${c1}:${v1}` : `${r.book} ${c1}:${v1}${en}${v2}`
      return `${r.book} ${c1}:${v1}${en}${c2}:${v2}`
    })
    .join('; ')
}
export function referencesOverlap(a: Reference[], b: Reference[]) {
  return a.some((x) => b.some((y) => x.book === y.book && x.start <= y.end && y.start <= x.end))
}
// Finds the first reference written inside a longer string, such as a file name.
export function findReference(text: string): string {
  const names = [...lookup.keys()]
    .filter((k) => k.length >= 2)
    .sort((x, y) => y.length - x.length)
    .map((k) =>
      k
        .replace(/ /g, String.raw`\s*`)
        .replace(/^(\d)/, String.raw`(?:$1|${['', 'i', 'ii', 'iii'][Number(k[0])] || ''})`),
    )
  const pattern = new RegExp(
    String.raw`(?<![A-Za-z])(?:${names.join('|')})\.?\s*\d+(?:\s*:\s*\d+(?:\s*[-–—]\s*(?:\d+\s*:\s*)?\d+)?)?(?!\d)`,
    'i',
  )
  const match = pattern.exec(text)
  return match && parseReferences(match[0]).complete ? match[0].trim() : ''
}
