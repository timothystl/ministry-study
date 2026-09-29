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
  lcms: string // the LCMS weekly Prayer of the Church, pasted in for the week
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
// The coming Sunday (today, if it is Sunday) as yyyy-mm-dd.
export function nextSunday(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  return d.toLocaleDateString('en-CA')
}
export const blankSet = (): PrayerSet => ({
  id: crypto.randomUUID(),
  date: nextSunday(),
  sunday: '',
  scripture: '',
  sermonId: '',
  selections: [],
  names: { sick: '', grieving: '', birthdays: '' },
  namesKept: false,
  other: '',
  petition: '',
  lcms: '',
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
  lcms?: string
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
const NAME_FALLBACKS = [
  ['sick', 'THE SICK', 'Lord Jesus, healer of the sick, be near'],
  ['grieving', 'THE GRIEVING', 'God of all comfort, hold those who mourn:'],
  ['birthdays', 'BIRTHDAYS AND ANNIVERSARIES', 'We give thanks for'],
] as const
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
  const covered = new Set<string>()
  for (const { categoryKey, prayerId } of input.selections) {
    const p = byId.get(prayerId)
    if (!p) continue
    covered.add(categoryKey || p.categoryKey)
    blocks.push(
      `${(p.category || 'Other').toUpperCase()}\n${withNames(stripResponse(p.text), categoryKey || p.categoryKey, input.names)}\n${RESPONSE}`,
    )
  }
  // Names typed in without a chosen bidding still get prayed for.
  for (const [key, heading, lead] of NAME_FALLBACKS) {
    const names = input.names[key].trim()
    if (names && !covered.has(key)) blocks.push(`${heading}\n${lead} ${names}.\n${RESPONSE}`)
  }
  if (input.lcms?.trim())
    blocks.push(`FROM THE LCMS WEEKLY PRAYER\n${stripResponse(input.lcms)}\n${RESPONSE}`)
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

// ----- A starter set, so the builder works before anything is imported -----
const starterSource = 'Starter biddings'
const starter = (
  categoryKey: string,
  category: string,
  categoryNote: string,
  items: [string, string][],
): Prayer[] =>
  items.map(([title, text], i) => ({
    ...blankPrayer(),
    title,
    text,
    type: 'Bidding',
    category,
    categoryKey,
    categoryNote,
    source: starterSource,
    sourceId: `${categoryKey}_${i + 1}`,
  }))
export const starterBiddings = (): Prayer[] => [
  ...starter('church', 'The Church', 'For the church throughout the world and this congregation', [
    [
      'Option A — Sent',
      'Gracious God, you gather your church around word and table and send us out in your name. Keep our pastors, teachers and people faithful, and make this congregation a place where the weary find rest and the lost are found.',
    ],
    [
      'Option B — One body',
      'Lord Jesus, you are the head of your body, the church. Where we are divided, make us one; where we are tired, renew us; where we are afraid, give us the courage of your Spirit.',
    ],
  ]),
  ...starter('world', 'The World', 'For peace, creation and those who suffer', [
    [
      'Option A — Peace',
      'God of all nations, you love the world you made. Bring peace where there is war, safety to refugees and the displaced, and food to the hungry, and teach us to be neighbors to people we will never meet.',
    ],
  ]),
  ...starter('nation', 'Our Nation and Community', 'For those in authority and for our neighbors', [
    [
      'Option A — Those in authority',
      'Lord, you rule over all things. Guide those who govern and serve in our nation, state and city with wisdom and integrity, and help us seek the good of the place where you have set us.',
    ],
  ]),
  ...starter('need', 'Those in Need', 'For the poor, the lonely, the burdened', [
    [
      'Option A — The burdened',
      'Father of mercies, we pray for those weighed down by poverty, loneliness, addiction, unemployment or fear. Meet them through your people and give us open hands and honest eyes.',
    ],
  ]),
  ...starter('sick', 'The Sick', 'Names are added from the sick field when building', [
    [
      'Option A — Healing',
      'Lord Jesus, healer of the sick, be near [names] and all who are ill or in pain. Give them your peace, strengthen those who care for them, and grant healing according to your good will.',
    ],
    [
      'Option B — Hold them',
      'Merciful God, we lift up [names]. Where we cannot fix, hold; where we cannot understand, stay; and let them know they are not forgotten.',
    ],
  ]),
  ...starter('grieving', 'The Grieving', 'Names are added from the grieving field when building', [
    [
      'Option A — Comfort',
      'God of all comfort, you wept at the tomb of your friend. Be with [names] and all who mourn; carry them through the long days, and keep before us the promise of the resurrection.',
    ],
  ]),
  ...starter(
    'birthdays',
    'Birthdays and Anniversaries',
    'Names are added from the birthdays field',
    [
      [
        'Option A — Thanksgiving',
        'We give thanks for the gift of life and love, and for [names], celebrating birthdays and anniversaries. Bless them in the year ahead and keep them in your care.',
      ],
    ],
  ),
  ...starter('thanks', 'Thanksgiving', 'For daily bread and every blessing', [
    [
      'Option A — Daily bread',
      'Giver of every good gift, we thank you for daily bread, for family and friends, for work and rest, and above all for Jesus Christ, our Savior. Teach us to receive it all with grateful hearts.',
    ],
  ]),
]
// Adds any starter biddings not already in the library.
export function loadStarterBiddings(library: Library) {
  return previewPrayerImport({ prayers: starterBiddings(), categories: 8, starters: 0 }, library)
}
// One bidding from each category, in category order, as a quick place to begin.
export function defaultSelections(prayers: Prayer[]) {
  return categories(prayers).map((c) => {
    const p = prayers.find((x) => x.type === 'Bidding' && (x.category || 'Other') === c.name)!
    return { categoryKey: c.key || c.name, prayerId: p.id }
  })
}

// ----- LCMS weekly prayers and sharing -----
// The LCMS publishes its Prayers of the Church as one PDF per Sunday. The text is copyrighted, so
// this links to the pages and lets the pastor paste the week's prayer in.
export const lcmsLinks = [
  [
    'Prayers of the Church: Three-Year Series',
    'https://www.lcms.org/worship/three-year-series-prayers',
  ],
  [
    'Prayers of the Church: One-Year Series',
    'https://www.lcms.org/worship/one-year-series-prayers',
  ],
  ['Pray for Us calendar', 'https://www.lcms.org/worship/pray-for-us-calendar'],
] as const
const MAILTO_LIMIT = 1800
// A mailto link for the prayers. Long prayers do not fit in a link, so the caller is told to paste.
export function prayerMailto(to: string, subject: string, body: string) {
  const link = (b: string) =>
    `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(b)}`
  const full = link(body)
  if (full.length <= MAILTO_LIMIT) return { href: full, complete: true }
  return {
    href: link('The prayers are copied to your clipboard. Paste them here.'),
    complete: false,
  }
}
const escapeHtml = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// A clean printable page (also saved as a PDF from the print dialog).
export const printableHtml = (text: string) =>
  `<!doctype html><meta charset="utf-8"><title>Prayers of the Church</title><style>body{font:16pt/1.5 Georgia,serif;max-width:6.5in;margin:.75in auto;white-space:pre-wrap}</style><body>${escapeHtml(text)}</body>`
