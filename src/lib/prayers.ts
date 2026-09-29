import type { Library } from './model'

// Prayers are kept as records (a bidding, a sermon-theme starter, or any prayer or devotion), and
// a Prayers of the Church is built by choosing one bidding per category. A built service can be
// saved for the record.
export const prayerTypes = ['Bidding', 'Sermon starter', 'Prayer', 'Devotion'] as const
export interface Prayer {
  id: string
  title: string
  text: string // a bidding is stored without its closing response, which the builder adds once
  type: (typeof prayerTypes)[number]
  category: string
  categoryKey: string // the import key; "sick", "grieving" and "birthdays" take names when building
  categoryNote: string
  tags: string[]
  notes: string
  source: string
  sourceId: string
  updatedAt: string
}
export interface PrayerSet {
  id: string
  date: string
  sunday: string
  scripture: string
  sermonId: string
  selections: { categoryKey: string; prayerId: string }[]
  names: { sick: string; grieving: string; birthdays: string }
  namesKept: boolean
  other: string
  petition: string
  text: string
  updatedAt: string
}
export const RESPONSE = 'Lord, in your mercy,\nHear our prayer.'
export const blankPrayer = (): Prayer => ({
  id: crypto.randomUUID(),
  title: '',
  text: '',
  type: 'Prayer',
  category: '',
  categoryKey: '',
  categoryNote: '',
  tags: [],
  notes: '',
  source: '',
  sourceId: '',
  updatedAt: '',
})
export const blankSet = (): PrayerSet => ({
  id: crypto.randomUUID(),
  date: new Date().toLocaleDateString('en-CA'),
  sunday: '',
  scripture: '',
  sermonId: '',
  selections: [],
  names: { sick: '', grieving: '', birthdays: '' },
  namesKept: false,
  other: '',
  petition: '',
  text: '',
  updatedAt: '',
})
const TRAILING = /\s*Lord,\s*in your mercy,?\s*$/i
// The bidding without its closing response, so the response is added exactly once.
export const stripResponse = (text: string) => text.trim().replace(TRAILING, '').trim()

export function savePrayer(library: Library, prayer: Prayer): Library {
  if (!prayer.title.trim() && !prayer.text.trim())
    throw new Error('A prayer needs a title or some text.')
  if (!prayer.text.trim()) throw new Error('A prayer needs its text.')
  const saved: Prayer = {
    ...prayer,
    title: prayer.title.trim(),
    text: prayer.text.trim(),
    tags: prayer.tags.map((t) => t.trim()).filter(Boolean),
    updatedAt: new Date().toISOString(),
  }
  const exists = library.prayers.some((p) => p.id === prayer.id)
  return {
    ...library,
    prayers: exists
      ? library.prayers.map((p) => (p.id === prayer.id ? saved : p))
      : [...library.prayers, saved],
  }
}
export const deletePrayer = (library: Library, id: string): Library => ({
  ...library,
  prayers: library.prayers.filter((p) => p.id !== id),
  prayerSets: library.prayerSets.map((s) => ({
    ...s,
    selections: s.selections.filter((x) => x.prayerId !== id),
  })),
})
export function categories(prayers: Prayer[]) {
  const seen = new Map<string, { key: string; name: string; note: string; count: number }>()
  for (const p of prayers) {
    if (p.type !== 'Bidding') continue
    const name = p.category || 'Other'
    const entry = seen.get(name) || { key: p.categoryKey, name, note: p.categoryNote, count: 0 }
    entry.count++
    seen.set(name, entry)
  }
  return [...seen.values()]
}
export function searchPrayers(prayers: Prayer[], query: string, category = '', type = '') {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return prayers.filter((p) => {
    if (category && (p.category || 'Other') !== category) return false
    if (type && p.type !== type) return false
    const hay = [p.title, p.text, p.category, p.notes, p.tags.join(' ')].join(' ').toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

// ----- Building -----
export interface BuildInput {
  date: string
  sunday: string
  scripture: string
  selections: { categoryKey: string; prayerId: string }[]
  names: PrayerSet['names']
  other: string
  petition: string
}
const PLACEHOLDER = /\[names?[^\]]*\]/gi
export function withNames(text: string, categoryKey: string, names: PrayerSet['names']) {
  const value =
    categoryKey === 'sick'
      ? names.sick
      : categoryKey === 'grieving'
        ? names.grieving
        : categoryKey === 'birthdays'
          ? names.birthdays
          : ''
  return value.trim() ? text.replace(PLACEHOLDER, value.trim()) : text
}
const longDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return y && m && d
    ? new Date(y, m - 1, d).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : iso
}
export function buildPrayers(input: BuildInput, prayers: Prayer[]): string {
  const byId = new Map(prayers.map((p) => [p.id, p]))
  const blocks: string[] = []
  const head = [
    input.sunday.trim() && `PRAYERS OF THE CHURCH\n${input.sunday.trim().toUpperCase()}`,
  ]
  if (!head[0]) head[0] = 'PRAYERS OF THE CHURCH'
  if (input.date) head.push(longDate(input.date))
  if (input.scripture.trim()) head.push(`Text: ${input.scripture.trim()}`)
  blocks.push(head.join('\n'))
  for (const { categoryKey, prayerId } of input.selections) {
    const p = byId.get(prayerId)
    if (!p) continue
    blocks.push(
      `${(p.category || 'Other').toUpperCase()}\n${withNames(stripResponse(p.text), categoryKey || p.categoryKey, input.names)}\n${RESPONSE}`,
    )
  }
  if (input.other.trim()) blocks.push(`OTHER CONCERNS\n${input.other.trim()}`)
  if (input.petition.trim())
    blocks.push(`SERMON-TIED PETITION\n${stripResponse(input.petition)}\n${RESPONSE}`)
  return blocks.join('\n\n') + '\n'
}

// ----- Import from the prayer builder file -----
export interface PrayerImport {
  prayers: Prayer[]
  categories: number
  starters: number
}
// Reads a list of categories with prayers (the builder's LIBRARY) and optional sermon-theme
// starters (its STARTERS). Accepts the builder's .tsx/.js file, or the same data as JSON.
export function parsePrayerFile(source: string): PrayerImport {
  let library: unknown
  let starters: Record<string, string> = {}
  const trimmed = source.trim()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const data = JSON.parse(trimmed)
    library = Array.isArray(data) ? data : data.library
    starters = (!Array.isArray(data) && data.starters) || {}
  } else {
    const start = source.search(/const\s+LIBRARY\s*=\s*\[/)
    if (start < 0) throw new Error('No prayer library was found in this file.')
    const open = source.indexOf('[', start)
    library = JSON.parse(source.slice(open, matchBracket(source, open) + 1))
    const s = source.search(/const\s+STARTERS\s*=\s*\{/)
    if (s >= 0) {
      const brace = source.indexOf('{', s)
      const body = source.slice(brace, matchBracket(source, brace) + 1)
      for (const m of body.matchAll(/^\s*(\w+)\s*:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/gm))
        starters[m[1]] = JSON.parse(m[2])
    }
  }
  if (!Array.isArray(library) || !library.length) throw new Error('The prayer library is empty.')
  const prayers: Prayer[] = []
  for (const cat of library as Record<string, unknown>[]) {
    if (typeof cat?.name !== 'string' || !Array.isArray(cat.prayers))
      throw new Error('A category is missing its name or prayers.')
    for (const item of cat.prayers as Record<string, unknown>[]) {
      if (typeof item?.text !== 'string' || !item.text.trim()) continue
      prayers.push({
        ...blankPrayer(),
        title: typeof item.name === 'string' ? item.name : '',
        text: stripResponse(item.text),
        type: 'Bidding',
        category: cat.name,
        categoryKey: typeof cat.id === 'string' ? cat.id : '',
        categoryNote: typeof cat.description === 'string' ? cat.description : '',
        source: 'Prayers of the Church builder',
        sourceId: typeof item.id === 'string' ? item.id : '',
      })
    }
  }
  const themes = Object.entries(starters)
  for (const [key, text] of themes)
    prayers.push({
      ...blankPrayer(),
      title: key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      text: stripResponse(text),
      type: 'Sermon starter',
      category: 'Sermon starters',
      categoryKey: 'starter',
      source: 'Prayers of the Church builder',
      sourceId: `starter:${key}`,
    })
  if (prayers.length > 2000) throw new Error('That is too many prayers to import at once.')
  return { prayers, categories: library.length, starters: themes.length }
}
function matchBracket(text: string, open: number) {
  const pair = text[open] === '[' ? ['[', ']'] : ['{', '}']
  let depth = 0
  let inString = false
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (c === '\\') i++
      else if (c === '"') inString = false
    } else if (c === '"') inString = true
    else if (c === pair[0]) depth++
    else if (c === pair[1] && --depth === 0) return i
  }
  throw new Error('This file is not in the expected format.')
}
export function previewPrayerImport(found: PrayerImport, library: Library) {
  const have = new Set(
    library.prayers
      .flatMap((p) => [p.sourceId && `${p.source}|${p.sourceId}`, `t|${p.text.slice(0, 80)}`])
      .filter(Boolean),
  )
  const fresh = found.prayers.filter(
    (p) => !have.has(`${p.source}|${p.sourceId}`) && !have.has(`t|${p.text.slice(0, 80)}`),
  )
  return {
    library: {
      ...library,
      prayers: [
        ...library.prayers,
        ...fresh.map((p) => ({ ...p, updatedAt: new Date().toISOString() })),
      ],
    },
    added: fresh.length,
    skipped: found.prayers.length - fresh.length,
  }
}
