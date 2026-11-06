import type { Book, Library } from './model'
import { scopedKey } from './storage'

// Bibliography and citation formatting for the common styles of theological and academic
// writing. Everything is worked out here in the browser from what is in the library (or typed
// in by hand); nothing is sent anywhere.

export const citationStyles = [
  { key: 'chicago', label: 'Chicago / Turabian (notes and bibliography)' },
  { key: 'chicago-ad', label: 'Chicago / Turabian (author-date)' },
  { key: 'sbl', label: 'SBL (Society of Biblical Literature)' },
  { key: 'mla', label: 'MLA' },
  { key: 'apa', label: 'APA' },
] as const
export type CitationStyle = (typeof citationStyles)[number]['key']

export const sourceKinds = [
  'Book',
  'Chapter in an edited book',
  'Journal article',
  'Website',
] as const
export type SourceKind = (typeof sourceKinds)[number]

export interface Source {
  id: string
  kind: SourceKind
  bookId?: string
  // Names separated by semicolons, written either "N. T. Wright" or "Wright, N. T.".
  authors: string
  editors: string
  translator: string
  title: string
  subtitle: string
  shortTitle: string
  // The book a chapter is in, the journal an article is in, or the website a page is on.
  container: string
  edition: string
  volume: string
  issue: string
  series: string
  seriesNumber: string
  place: string
  publisher: string
  year: string
  // Pages of the chapter or article as a whole.
  pages: string
  // The page or pages cited in a note or in-text citation.
  cited: string
  url: string
  accessed: string
}

export const blankSource = (kind: SourceKind = 'Book'): Source => ({
  id: crypto.randomUUID(),
  kind,
  authors: '',
  editors: '',
  translator: '',
  title: '',
  subtitle: '',
  shortTitle: '',
  container: '',
  edition: '',
  volume: '',
  issue: '',
  series: '',
  seriesNumber: '',
  place: '',
  publisher: '',
  year: '',
  pages: '',
  cited: '',
  url: '',
  accessed: '',
})

// A library book as a source. Place of publication is not kept on books, so it is left for the
// pastor to fill in when a style calls for it.
export function sourceFromBook(book: Book, library: Library): Source {
  const meta = book.sourceMetadata || {}
  const series = library.series.find((s) => s.id === book.seriesId)?.name || ''
  const pick = (...keys: string[]) =>
    keys
      .map((k) => meta[k])
      .find((v) => v?.trim())
      ?.trim() || ''
  let title = book.title.trim(),
    subtitle = (book.subtitle || '').trim()
  if (!subtitle && title.includes(': ')) {
    const at = title.indexOf(': ')
    subtitle = title.slice(at + 2)
    title = title.slice(0, at)
  }
  return {
    ...blankSource('Book'),
    bookId: book.id,
    authors: book.author.trim(),
    title,
    subtitle,
    edition: (book.edition ?? meta.Edition ?? '').trim(),
    series,
    seriesNumber: series ? book.volume.trim() : '',
    volume: series ? '' : book.volume.trim(),
    place: pick('Place', 'Publication place', 'Publisher location', 'City'),
    publisher: book.publisher.trim(),
    year: (book.year.match(/\d{4}/)?.[0] || book.year).trim(),
  }
}

// Formatted text is a list of pieces, some italic, so it can be shown, copied with its italics,
// or saved for a word processor.
export interface Piece {
  text: string
  italic?: boolean
}
export type Formatted = Piece[]

export interface Name {
  first: string
  last: string
  suffix: string
}

const suffixes = /^(jr\.?|sr\.?|ii|iii|iv)$/i
export function parseName(raw: string): Name {
  const s = raw.trim().replace(/\s+/g, ' ')
  if (!s) return { first: '', last: '', suffix: '' }
  const parts = s.split(',').map((p) => p.trim())
  if (parts.length >= 2 && !suffixes.test(parts[1])) {
    // "Last, First" or "Last, First, Jr."
    return { last: parts[0], first: parts[1], suffix: parts[2] || '' }
  }
  let words = parts[0].split(' ')
  let suffix = parts[1] || ''
  if (!suffix && words.length > 2 && suffixes.test(words.at(-1)!)) {
    suffix = words.at(-1)!
    words = words.slice(0, -1)
  }
  if (words.length === 1) return { first: '', last: words[0], suffix }
  // Lowercase particles (von, de, van der) stay with the surname.
  let at = words.length - 1
  while (at > 1 && /^(von|van|de|der|den|du|da|di|la|le)$/.test(words[at - 1])) at--
  return { first: words.slice(0, at).join(' '), last: words.slice(at).join(' '), suffix }
}

export function splitNames(raw: string): Name[] {
  const text = raw.trim()
  if (!text) return []
  const list = text.includes(';')
    ? text.split(';')
    : // "A and B", "A & B"; a single comma is "Last, First", so commas only split when there are
      // several names written "First Last, First Last".
      text.split(/\s+(?:and|&)\s+/).flatMap((p) => {
        const commas = p.split(',').map((x) => x.trim())
        return commas.length > 2 || (commas.length === 2 && commas.every((c) => c.includes(' ')))
          ? commas.filter((c) => !suffixes.test(c))
          : [p]
      })
  return list.map(parseName).filter((n) => n.last)
}

const withSuffix = (s: string, n: Name, sep = ', ') => (n.suffix ? `${s}${sep}${n.suffix}` : s)
const natural = (n: Name) => withSuffix([n.first, n.last].filter(Boolean).join(' '), n, ' ')
const inverted = (n: Name) => withSuffix(n.first ? `${n.last}, ${n.first}` : n.last, n)
export const initials = (first: string) =>
  first
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      w
        .split('-')
        .map((p) => (p.replace(/\./g, '') ? `${p.replace(/\./g, '')[0].toUpperCase()}.` : ''))
        .join('-'),
    )
    .join(' ')
const apaName = (n: Name) => withSuffix(n.first ? `${n.last}, ${initials(n.first)}` : n.last, n)

function series(list: string[], conj = 'and') {
  if (list.length <= 1) return list.join('')
  if (list.length === 2) return `${list[0]} ${conj} ${list[1]}`
  return `${list.slice(0, -1).join(', ')}, ${conj} ${list.at(-1)}`
}
// Two names in a bibliography put a comma after the inverted first one: "Wright, N. T., and ...".
function bibNames(names: Name[]) {
  if (names.length === 2) return `${inverted(names[0])}, and ${natural(names[1])}`
  return series([inverted(names[0]), ...names.slice(1).map(natural)])
}
function noteNames(names: Name[]) {
  return names.length > 3 ? `${natural(names[0])} et al.` : series(names.map(natural))
}
function shortNames(names: Name[]) {
  if (names.length > 3) return `${names[0].last} et al.`
  return series(names.map((n) => n.last))
}

// Punctuation and joining helpers.
const endsWithMark = (s: string) => /[.?!]$/.test(s.trim())
const range = (s: string) => s.trim().replace(/\s*[-–—]+\s*/g, '–')
const edition = (raw: string) => {
  const e = raw.trim()
  if (!e) return ''
  if (/^\d+$/.test(e)) {
    const n = Number(e)
    const suffix =
      n % 100 >= 11 && n % 100 <= 13
        ? 'th'
        : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th'
    return n === 1 ? '' : `${n}${suffix} ed.`
  }
  if (/^rev(ised|\.)?$/i.test(e)) return 'rev. ed.'
  return /\bed(ition|\.)?\b/i.test(e) ? e.replace(/edition/i, 'ed.') : `${e} ed.`
}
const capFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const fullTitle = (s: Source) =>
  s.subtitle.trim()
    ? `${s.title.trim()}${endsWithMark(s.title) ? '' : ':'} ${s.subtitle.trim()}`
    : s.title.trim()
const shortTitle = (s: Source) => {
  if (s.shortTitle.trim()) return s.shortTitle.trim()
  // Up to four words, not ending on a small word ("The Resurrection of the" becomes "The
  // Resurrection"); a different short title can be typed in.
  const words = s.title.trim().split(/\s+/)
  if (words.length <= 4) return s.title.trim()
  const kept = words.slice(0, 4)
  while (
    kept.length > 1 &&
    /^(a|an|the|of|and|or|in|on|to|for|with|from|by|at)$/i.test(kept.at(-1)!)
  )
    kept.pop()
  return kept.join(' ').replace(/[,:;]$/, '')
}
// A quoted title takes the following comma or period inside the closing quotation mark.
const quoted = (title: string, mark: string) =>
  endsWithMark(title) ? `“${title}”` : `“${title}${mark}”`

// Builds formatted text from pieces, dropping empty ones.
class Out {
  pieces: Piece[] = []
  add(text: string | false | undefined | null, italic = false) {
    if (!text) return this
    const last = this.pieces.at(-1)
    if (last && Boolean(last.italic) === italic) last.text += text
    else this.pieces.push(italic ? { text, italic } : { text })
    return this
  }
  get text() {
    return this.pieces.map((p) => p.text).join('')
  }
  // End a sentence: a period unless the text already ends with one (or ? or !).
  stop() {
    const t = this.text.trimEnd()
    if (t && !/[.?!]["”’]?$/.test(t)) this.add('.')
    return this
  }
  done(): Formatted {
    const last = this.pieces.at(-1)
    if (last) last.text = last.text.replace(/\s+$/, '')
    return this.pieces.filter((p) => p.text)
  }
}

export const plainText = (f: Formatted) => f.map((p) => p.text).join('')
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const html = (f: Formatted) =>
  f.map((p) => (p.italic ? `<i>${escapeHtml(p.text)}</i>` : escapeHtml(p.text))).join('')

const rtfEscape = (s: string) =>
  [...s]
    .map((c) => {
      if (c === '\\' || c === '{' || c === '}') return `\\${c}`
      const code = c.codePointAt(0)!
      if (code < 128) return c
      if (code > 0xffff) {
        const hi = Math.floor((code - 0x10000) / 0x400) + 0xd800
        const lo = ((code - 0x10000) % 0x400) + 0xdc00
        return `\\u${hi - 65536}?\\u${lo - 65536}?`
      }
      return `\\u${code > 32767 ? code - 65536 : code}?`
    })
    .join('')
const rtfPieces = (f: Formatted) =>
  f.map((p) => (p.italic ? `{\\i ${rtfEscape(p.text)}}` : rtfEscape(p.text))).join('')

// A document Word, Pages and Google Docs open directly: a heading and hanging-indent entries,
// in Times New Roman 12 point, double-spaced as the styles ask.
export function rtfDocument(
  heading: string,
  entries: Formatted[],
  notes?: { heading: string; items: Formatted[] },
) {
  const para = (f: Formatted) => `{\\pard\\li720\\fi-720\\sl480\\slmult1 ${rtfPieces(f)}\\par}`
  const head = (t: string) => `{\\pard\\qc\\sl480\\slmult1 ${rtfEscape(t)}\\par}`
  const noteParas = notes
    ? [
        `{\\pard\\par}`,
        head(notes.heading),
        ...notes.items.map(
          (f, i) => `{\\pard\\fi360\\sl240\\slmult1\\sa240 ${i + 1}. ${rtfPieces(f)}\\par}`,
        ),
      ]
    : []
  return [
    '{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\froman Times New Roman;}}\\f0\\fs24',
    head(heading),
    ...entries.map(para),
    ...noteParas,
    '}',
  ].join('\n')
}

export interface Citation {
  entry: Formatted
  // First (full) note and later short note, for the note styles.
  note?: Formatted
  shortNote?: Formatted
  // Parenthetical citation in the text, for the author-date styles.
  inText?: Formatted
}

export const usesNotes = (style: CitationStyle) => style === 'chicago' || style === 'sbl'
export const listHeading = (style: CitationStyle) =>
  style === 'mla'
    ? 'Works Cited'
    : style === 'apa' || style === 'chicago-ad'
      ? 'References'
      : 'Bibliography'

interface People {
  authors: Name[]
  editors: Name[]
  // When a book has editors but no authors, the editors stand in the author's place.
  editorsLead: boolean
}
function people(s: Source): People {
  const authors = splitNames(s.authors)
  const editors = splitNames(s.editors)
  return {
    authors: authors.length ? authors : editors,
    editors,
    editorsLead: !authors.length && editors.length > 0,
  }
}

const cited = (s: Source) => range(s.cited)
const year = (s: Source) => s.year.trim() || 'n.d.'

function chicagoStyle(s: Source, mode: 'chicago' | 'sbl' | 'ad'): Citation {
  const sbl = mode === 'sbl',
    ad = mode === 'ad'
  const p = people(s)
  const edLabel = (n: Name[]) => (n.length > 1 ? ', eds.' : ', ed.')
  const title = fullTitle(s)
  const ed = edition(s.edition)
  const seriesText = [s.series.trim(), s.seriesNumber.trim()].filter(Boolean).join(' ')
  const pub = [s.place.trim(), s.publisher.trim()].filter(Boolean).join(': ')
  const imprint = [pub, year(s)].filter(Boolean).join(', ')
  const at = cited(s)
  const leadEditors = p.editorsLead ? p.editors : []
  const otherEditors = p.editorsLead ? [] : p.editors
  const translators = series(splitNames(s.translator).map(natural))

  // The bibliography entry is built as names, title, and the rest, so author-date can put the
  // year after the names (or after the title when there are no names).
  const head = new Out()
  const titled = new Out()
  const rest = new Out()
  const note = new Out()
  const short = new Out()
  if (p.authors.length) {
    head.add(bibNames(p.authors) + (p.editorsLead ? edLabel(leadEditors) : '')).stop()
    note.add(noteNames(p.authors) + (p.editorsLead ? edLabel(leadEditors) : '')).add(', ')
    short.add(shortNames(p.authors)).add(', ')
  }

  if (s.kind === 'Book') {
    titled.add(title, true).stop()
    if (s.volume.trim()) rest.add(` Vol. ${s.volume.trim()}.`)
    if (otherEditors.length) rest.add(` Edited by ${series(otherEditors.map(natural))}.`)
    if (translators) rest.add(` Translated by ${translators}.`)
    if (ed) rest.add(` ${capFirst(ed)}`)
    if (seriesText) rest.add(` ${seriesText}`).stop()
    rest.add(` ${ad ? pub : imprint}`).stop()

    note.add(title, true)
    if (s.volume.trim() && !at) note.add(`, vol. ${s.volume.trim()}`)
    if (otherEditors.length) note.add(`, ed. ${series(otherEditors.map(natural))}`)
    if (translators) note.add(`, trans. ${translators}`)
    if (ed) note.add(`, ${ed}`)
    if (seriesText) note.add(`, ${seriesText}`)
    note.add(` (${imprint})`)
    if (at) note.add(s.volume.trim() ? `, ${s.volume.trim()}:${at}` : `, ${at}`)
    note.add('.')

    short.add(shortTitle(s), true)
    if (at) short.add(s.volume.trim() ? `, ${s.volume.trim()}:${at}` : `, ${at}`)
    short.add('.')
  } else if (s.kind === 'Chapter in an edited book') {
    const eds = series(splitNames(s.editors).map(natural))
    titled.add(quoted(title, '.'))
    rest.add(' In ').add(s.container.trim(), true)
    if (eds) rest.add(`, edited by ${eds}`)
    if (s.pages.trim()) rest.add(`, ${range(s.pages)}`)
    rest.add('.')
    if (translators) rest.add(` Translated by ${translators}.`)
    if (seriesText) rest.add(` ${seriesText}`).stop()
    rest.add(` ${ad ? pub : imprint}`).stop()

    note.add(quoted(title, ',')).add(' in ').add(s.container.trim(), true)
    if (eds) note.add(`, ed. ${eds}`)
    if (seriesText) note.add(`, ${seriesText}`)
    note.add(` (${imprint})`)
    if (at) note.add(`, ${at}`)
    note.add('.')

    short.add(quoted(shortTitle(s), at ? ',' : '.'))
    if (at) short.add(` ${at}.`)
  } else if (s.kind === 'Journal article') {
    const vol =
      sbl && s.issue.trim()
        ? `${s.volume.trim()}.${s.issue.trim()}`
        : [s.volume.trim(), s.issue.trim() && `, no. ${s.issue.trim()}`].filter(Boolean).join('')
    const pages = s.pages.trim() ? range(s.pages) : ''
    titled.add(quoted(title, '.'))
    rest.add(' ').add(s.container.trim(), true)
    if (vol) rest.add(` ${vol}`)
    if (!ad) rest.add(` (${year(s)})`)
    if (pages) rest.add(`: ${pages}`)
    rest.stop()
    if (s.url.trim()) rest.add(` ${s.url.trim()}`).stop()

    note.add(quoted(title, ',')).add(' ').add(s.container.trim(), true)
    if (vol) note.add(` ${vol}`)
    note.add(` (${year(s)})`)
    if (at) note.add(`: ${at}`)
    note.add('.')

    short.add(quoted(shortTitle(s), at ? ',' : '.'))
    if (at) short.add(` ${at}.`)
  } else {
    titled.add(quoted(title, '.'))
    if (s.container.trim()) rest.add(` ${s.container.trim()}`).stop()
    if (s.year.trim() && !ad) rest.add(` ${s.year.trim()}.`)
    else if (!s.year.trim() && s.accessed.trim()) rest.add(` Accessed ${s.accessed.trim()}.`)
    if (s.url.trim()) rest.add(` ${s.url.trim()}`).stop()

    const bits = [
      s.container.trim(),
      s.year.trim() || (s.accessed.trim() && `accessed ${s.accessed.trim()}`),
      s.url.trim(),
    ].filter(Boolean)
    note.add(quoted(title, bits.length ? ',' : '.'))
    if (bits.length) note.add(` ${bits.join(', ')}.`)

    short.add(quoted(shortTitle(s), '.'))
  }

  const bib = new Out()
  const append = (o: Out) => o.pieces.forEach((x) => bib.add(x.text, x.italic))
  if (!ad) {
    append(head)
    if (head.pieces.length) bib.add(' ')
    append(titled)
  } else if (head.pieces.length) {
    append(head)
    bib
      .add(` ${year(s)}`)
      .stop()
      .add(' ')
    append(titled)
  } else {
    append(titled)
    bib.add(` ${year(s)}`).stop()
  }
  append(rest)
  // Drop a dangling "Place:" when the publisher is missing, and doubled spaces.
  bib.pieces.forEach((x) => (x.text = x.text.replace(/ {2,}/g, ' ').replace(/ \./g, '.')))
  const entry = bib.done()
  return ad
    ? { entry, inText: inTextAuthorDate(s, ' ') }
    : { entry, note: note.done(), shortNote: short.done() }
}

function inTextAuthorDate(s: Source, sep: string, pagePrefix = ''): Formatted {
  const p = people(s)
  const apa = sep === ', '
  const who =
    p.authors.length > 2
      ? `${p.authors[0].last} et al.`
      : p.authors.length === 2
        ? `${p.authors[0].last} ${apa ? '&' : 'and'} ${p.authors[1].last}`
        : p.authors[0]?.last
  const out = new Out().add('(')
  if (who) out.add(`${who}${sep === ', ' ? ',' : ''} `)
  else if (s.kind === 'Book' || (apa && s.kind === 'Website'))
    out.add(shortTitle(s), true).add(apa ? ', ' : ' ')
  else out.add(`“${shortTitle(s)}${apa ? ',”' : '”'} `)
  out.add(year(s))
  if (cited(s)) out.add(`, ${pagePrefix}${cited(s)}`)
  return out.add(')').done()
}

function mla(s: Source): Citation {
  const p = people(s)
  const out = new Out()
  if (p.authors.length) {
    const names =
      p.authors.length === 1
        ? inverted(p.authors[0])
        : p.authors.length === 2
          ? `${inverted(p.authors[0])}, and ${natural(p.authors[1])}`
          : `${inverted(p.authors[0])}, et al`
    out
      .add(names + (p.editorsLead ? (p.editors.length > 1 ? ', editors' : ', editor') : ''))
      .stop()
      .add(' ')
  }
  const title = fullTitle(s)
  const pub = s.publisher.trim()
  const other: string[] = []
  if (s.kind === 'Book') {
    out.add(title, true).stop().add(' ')
    if (!p.editorsLead && p.editors.length)
      other.push(`Edited by ${series(p.editors.map(natural))}`)
    if (s.translator.trim())
      other.push(`Translated by ${series(splitNames(s.translator).map(natural))}`)
    if (edition(s.edition)) other.push(edition(s.edition))
    if (s.volume.trim()) other.push(`vol. ${s.volume.trim()}`)
    if (pub) other.push(pub)
    other.push(s.year.trim())
    out.add(capFirst(other.filter(Boolean).join(', '))).stop()
    if (s.series.trim())
      out.add(` ${[s.series.trim(), s.seriesNumber.trim()].filter(Boolean).join(' ')}`).stop()
  } else if (s.kind === 'Chapter in an edited book') {
    out.add(quoted(title, '.')).add(' ').add(s.container.trim(), true)
    if (s.editors.trim()) other.push(`edited by ${series(splitNames(s.editors).map(natural))}`)
    if (pub) other.push(pub)
    other.push(s.year.trim())
    if (s.pages.trim()) other.push(`${/[-–]/.test(s.pages) ? 'pp.' : 'p.'} ${range(s.pages)}`)
    out
      .add(
        other
          .filter(Boolean)
          .map((x) => `, ${x}`)
          .join(''),
      )
      .stop()
  } else if (s.kind === 'Journal article') {
    out.add(quoted(title, '.')).add(' ').add(s.container.trim(), true)
    if (s.volume.trim()) other.push(`vol. ${s.volume.trim()}`)
    if (s.issue.trim()) other.push(`no. ${s.issue.trim()}`)
    other.push(s.year.trim())
    if (s.pages.trim()) other.push(`${/[-–]/.test(s.pages) ? 'pp.' : 'p.'} ${range(s.pages)}`)
    out
      .add(
        other
          .filter(Boolean)
          .map((x) => `, ${x}`)
          .join(''),
      )
      .stop()
    if (s.url.trim()) out.add(` ${s.url.trim().replace(/^https?:\/\//, '')}`).stop()
  } else {
    out.add(quoted(title, '.'))
    if (s.container.trim()) out.add(' ').add(s.container.trim(), true).add(',')
    if (s.year.trim()) out.add(` ${s.year.trim()},`)
    if (s.url.trim()) out.add(` ${s.url.trim().replace(/^https?:\/\//, '')}`)
    out.pieces.forEach((x) => (x.text = x.text.replace(/,$/, '')))
    out.stop()
    if (s.accessed.trim()) out.add(` Accessed ${s.accessed.trim()}.`)
  }
  const inText = new Out().add('(')
  const who =
    p.authors.length > 2
      ? `${p.authors[0].last} et al.`
      : p.authors.length === 2
        ? `${p.authors[0].last} and ${p.authors[1].last}`
        : p.authors[0]?.last
  if (who) inText.add(who)
  else if (s.kind === 'Book') inText.add(shortTitle(s), true)
  else inText.add(`“${shortTitle(s)}”`)
  if (cited(s)) inText.add(` ${cited(s)}`)
  return { entry: out.done(), inText: inText.add(')').done() }
}

function apa(s: Source): Citation {
  const p = people(s)
  const out = new Out()
  const names = p.authors.map(apaName)
  const nameText =
    names.length === 1
      ? names[0]
      : names.length <= 20
        ? `${names.slice(0, -1).join(', ')}, & ${names.at(-1)}`
        : `${names.slice(0, 19).join(', ')}, . . . ${names.at(-1)}`
  const title = fullTitle(s)
  const pub = s.publisher.trim()
  const ed = edition(s.edition)
  if (names.length) {
    out.add(nameText)
    if (p.editorsLead) out.add(p.editors.length > 1 ? ' (Eds.)' : ' (Ed.)').add('.')
    out.stop().add(` (${year(s)}). `)
  }
  const bookExtras = () => {
    const bits = [ed, s.volume.trim() && `Vol. ${s.volume.trim()}`].filter(Boolean)
    return bits.length ? ` (${bits.join(', ')})` : ''
  }
  if (s.kind === 'Book') {
    out.add(title, true).add(bookExtras())
    if (s.translator.trim())
      out.add(
        ` (${series(
          splitNames(s.translator).map((n) => `${initials(n.first)} ${n.last}`.trim()),
          '&',
        )}, Trans.)`,
      )
    out.stop()
    if (!names.length) out.add(` (${year(s)}).`)
    if (pub) out.add(` ${pub}`).stop()
  } else if (s.kind === 'Chapter in an edited book') {
    out.add(title).stop()
    if (!names.length) out.add(` (${year(s)}).`)
    out.add(' In ')
    const eds = splitNames(s.editors)
    if (eds.length)
      out.add(
        `${series(
          eds.map((n) => `${initials(n.first)} ${n.last}`.trim()),
          '&',
        )} (${eds.length > 1 ? 'Eds.' : 'Ed.'}), `,
      )
    out.add(s.container.trim(), true)
    const bits = [ed, s.pages.trim() && `pp. ${range(s.pages)}`].filter(Boolean)
    if (bits.length) out.add(` (${bits.join(', ')})`)
    out.stop()
    if (pub) out.add(` ${pub}`).stop()
  } else if (s.kind === 'Journal article') {
    out.add(title).stop()
    if (!names.length) out.add(` (${year(s)}).`)
    out.add(' ').add(s.container.trim(), true)
    if (s.volume.trim()) out.add(', ').add(s.volume.trim(), true)
    if (s.issue.trim()) out.add(`(${s.issue.trim()})`)
    if (s.pages.trim()) out.add(`, ${range(s.pages)}`)
    out.stop()
    if (s.url.trim()) out.add(` ${s.url.trim()}`)
  } else {
    out.add(title, true).stop()
    if (!names.length) out.add(` (${year(s)}).`)
    if (s.container.trim() && s.container.trim() !== nameText)
      out.add(` ${s.container.trim()}`).stop()
    if (s.url.trim()) out.add(` ${s.url.trim()}`)
  }
  return {
    entry: out.done(),
    inText: inTextAuthorDate(s, ', ', /[-–,]/.test(s.cited) ? 'pp. ' : 'p. '),
  }
}

export function cite(s: Source, style: CitationStyle): Citation {
  if (style === 'chicago' || style === 'sbl') return chicagoStyle(s, style)
  if (style === 'chicago-ad') return chicagoStyle(s, 'ad')
  if (style === 'mla') return mla(s)
  return apa(s)
}

// Alphabetical by the first author's surname (or the title when there is none), ignoring a
// leading "The", "A" or "An".
export function sortKey(s: Source) {
  const first = people(s).authors[0]
  const title = fullTitle(s).replace(/^(the|a|an)\s+/i, '')
  return [first ? `${first.last} ${first.first}` : title, s.year, title]
    .join('|')
    .toLocaleLowerCase()
}
export const sortSources = (list: Source[]) =>
  [...list].sort((a, b) => sortKey(a).localeCompare(sortKey(b), undefined, { numeric: true }))

// What a style needs that the entry is missing, so the page can say so plainly.
export function missing(s: Source, style: CitationStyle): string[] {
  const need: string[] = []
  if (!s.title.trim()) need.push('title')
  if (!s.authors.trim() && !s.editors.trim() && s.kind !== 'Website') need.push('author or editor')
  if (s.kind !== 'Website' && !s.year.trim()) need.push('year')
  if (s.kind === 'Book' || s.kind === 'Chapter in an edited book') {
    if (!s.publisher.trim()) need.push('publisher')
    if ((style === 'chicago' || style === 'sbl' || style === 'chicago-ad') && !s.place.trim())
      need.push('place of publication')
  }
  if (s.kind !== 'Book' && !s.container.trim())
    need.push(
      s.kind === 'Journal article'
        ? 'journal'
        : s.kind === 'Website'
          ? 'website name'
          : 'book title',
    )
  if (s.kind === 'Website' && !s.url.trim()) need.push('web address')
  return need
}

// The working list is kept in this browser, one per person, like a draft.
const listKey = () => scopedKey('ministry-study.bibliography.v1')
export interface SavedList {
  style: CitationStyle
  sources: Source[]
}
export function loadList(): SavedList {
  try {
    const raw = localStorage.getItem(listKey())
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedList>
      if (Array.isArray(parsed.sources))
        return {
          style: citationStyles.some((c) => c.key === parsed.style) ? parsed.style! : 'chicago',
          sources: parsed.sources.map((x) => ({ ...blankSource(), ...x })),
        }
    }
  } catch {
    // An unreadable list starts over empty.
  }
  return { style: 'chicago', sources: [] }
}
export function saveList(list: SavedList) {
  try {
    localStorage.setItem(listKey(), JSON.stringify(list))
    return true
  } catch {
    return false
  }
}
