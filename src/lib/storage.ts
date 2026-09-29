import { z } from 'zod'
import {
  blankBook,
  formats,
  ownerships,
  validCoverUrl,
  readingStatuses,
  verificationStatuses,
  type Library,
} from './model'
import { fileKinds, itemKinds, liturgyKinds } from './hymns'
import { noteKinds } from './notes'
import { prayerTypes } from './prayers'
import { sampleLibrary } from './seed'
const location = z.object({
  room: z.string(),
  bookcase: z.string(),
  shelf: z.string(),
  position: z.string(),
})
const date = z
  .string()
  .refine(
    (v) => v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))),
    'Invalid date',
  )
const book = z.object({
  coverSource: z
    .object({
      name: z.string(),
      url: z.string().refine((v) => v === '' || (URL.canParse(v) && v.startsWith('https://'))),
      selectedAt: z.string(),
    })
    .optional(),
  verification: z
    .object({ status: z.enum(verificationStatuses), checkedAt: date, notes: z.string() })
    .refine(
      (v) => v.status !== 'Confirmed' || Boolean(v.checkedAt),
      'Confirmed books need a check date',
    )
    .optional(),
  edition: z.string().optional(),
  subtitle: z.string().optional(),
  coverUrl: z
    .string()
    .refine((v) => !v || validCoverUrl(v), 'Use an HTTPS cover URL')
    .optional(),
  useFor: z.array(z.string()).optional(),
  id: z.string().min(1),
  title: z.string().trim().min(1),
  author: z.string(),
  publisher: z.string(),
  year: z.string(),
  isbn: z.string(),
  format: z.enum(formats),
  ownership: z.enum(ownerships),
  wishlist: z.boolean(),
  license: z.enum(['Permanent', 'Temporary', 'Unknown']),
  topics: z.array(z.string()),
  seriesId: z.string(),
  volume: z.string(),
  notes: z.string(),
  summary: z.string(),
  reading: z.object({
    status: z.enum(readingStatuses),
    started: date,
    finished: date,
    rating: z.number().int().min(0).max(5),
    source: z.string(),
  }),
  location,
  recommendedLocation: location,
  source: z.string(),
  sourceId: z.string(),
  sourceMetadata: z.record(z.string(), z.string()).optional(),
  updatedAt: z.string(),
})
const sermon = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  scripture: z.string(),
  date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  occasion: z.string(),
  subject: z.string().default(''),
  series: z.string(),
  themes: z.array(z.string()),
  summary: z.string(),
  notes: z.string(),
  manuscript: z.string(),
  recording: z.string(),
  sourceId: z.string().default(''),
  season: z.string().default(''),
  lectionaryYear: z.string().default(''),
  liturgicalDay: z.string().default(''),
  scriptureSource: z.string().default(''),
  structure: z.string().default(''),
  structureCategory: z.string().default(''),
  structureConfidence: z.string().default(''),
  structureNote: z.string().default(''),
  structureSource: z.string().default(''),
  centralImage: z.string().default(''),
  gospelHandle: z.string().default(''),
  opening: z.string().default(''),
  closing: z.string().default(''),
  reviewNote: z.string().default(''),
  formerTitles: z.array(z.string()).default([]),
  source: z.string(),
  updatedAt: z.string(),
})
const prayer = z.object({
  id: z.string().min(1),
  title: z.string(),
  text: z.string().min(1),
  type: z.enum(prayerTypes),
  category: z.string(),
  categoryKey: z.string(),
  categoryNote: z.string(),
  tags: z.array(z.string()),
  notes: z.string(),
  source: z.string(),
  sourceId: z.string(),
  updatedAt: z.string(),
})
const prayerSet = z.object({
  id: z.string().min(1),
  date: z.string(),
  sunday: z.string(),
  scripture: z.string(),
  sermonId: z.string(),
  selections: z.array(z.object({ categoryKey: z.string(), prayerId: z.string() })),
  names: z.object({ sick: z.string(), grieving: z.string(), birthdays: z.string() }),
  namesKept: z.boolean(),
  other: z.string(),
  petition: z.string(),
  lcms: z.string().default(''),
  text: z.string(),
  updatedAt: z.string(),
})
const note = z.object({
  id: z.string().min(1),
  title: z.string(),
  kind: z.enum(noteKinds),
  body: z.string(),
  scripture: z.string(),
  date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  sermonId: z.string(),
  tags: z.array(z.string()),
  source: z.string(),
  updatedAt: z.string(),
})
const hymnFile = z.object({ kind: z.enum(fileKinds), location: z.string() })
const hymn = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  firstLine: z.string().default(''),
  tune: z.string().default(''),
  composer: z.string().default(''),
  lyricist: z.string().default(''),
  arranger: z.string().default(''),
  meter: z.string().default(''),
  scripture: z.string().default(''),
  year: z.string().default(''),
  key: z.string().default(''),
  hymnal: z.string().default(''),
  usage: z.array(z.string()).default([]),
  themes: z.array(z.string()).default([]),
  text: z.string().default(''),
  copyright: z.string().default(''),
  links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  files: z.array(hymnFile).default([]),
  attachments: z
    .array(
      z.object({
        id: z.string().min(8),
        name: z.string(),
        mime: z.string(),
        size: z.number(),
        addedAt: z.string(),
      }),
    )
    .default([]),
  notes: z.string().default(''),
  source: z.string().default(''),
  sourceId: z.string().default(''),
  updatedAt: z.string(),
})
const liturgy = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  kind: z.enum(liturgyKinds),
  season: z.string().default(''),
  date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  items: z.array(
    z.object({
      id: z.string().min(1),
      kind: z.enum(itemKinds),
      label: z.string(),
      hymnId: z.string(),
      scripture: z.string(),
      text: z.string(),
    }),
  ),
  files: z.array(hymnFile).default([]),
  notes: z.string().default(''),
  source: z.string().default(''),
  updatedAt: z.string(),
})
const schema = z.object({
  version: z.literal(1),
  recentIds: z.array(z.string()).optional(),
  books: z.array(book),
  series: z.array(z.object({ id: z.string().min(1), name: z.string().trim().min(1) })),
  loans: z.array(
    z.object({
      id: z.string().min(1),
      bookId: z.string(),
      borrower: z.string().trim().min(1),
      loanedAt: date.refine(Boolean),
      dueAt: date,
      returnedAt: date,
      notes: z.string(),
    }),
  ),
  sermons: z.array(sermon).default([]),
  prayers: z.array(prayer).default([]),
  prayerSets: z.array(prayerSet).default([]),
  notes: z.array(note).default([]),
  hymns: z.array(hymn).default([]),
  liturgies: z.array(liturgy).default([]),
  sample: z.boolean(),
})
export const STORAGE_KEY = 'ministry-study.library.v1'
export function parseBackup(input: unknown): Library {
  const data = schema.parse(input)
  for (const items of [
    data.books,
    data.series,
    data.loans,
    data.sermons,
    data.prayers,
    data.prayerSets,
    data.notes,
    data.hymns,
    data.liturgies,
  ])
    if (new Set(items.map((x) => x.id)).size !== items.length)
      throw new Error('Duplicate record IDs in backup.')
  const active = new Set<string>()
  for (const b of data.books) {
    if (b.seriesId && !data.series.some((s) => s.id === b.seriesId))
      throw new Error('Missing series in backup.')
    if (b.reading.started && b.reading.finished && b.reading.finished < b.reading.started)
      throw new Error('Invalid reading dates.')
  }
  for (const l of data.loans) {
    const b = data.books.find((b) => b.id === l.bookId)
    if (!b || (l.dueAt && l.dueAt < l.loanedAt) || (l.returnedAt && l.returnedAt < l.loanedAt))
      throw new Error('Invalid loan record.')
    if (!l.returnedAt) {
      if (active.has(l.bookId) || b.format !== 'Physical' || b.ownership !== 'Owned')
        throw new Error('Invalid active loan.')
      active.add(l.bookId)
    }
  }
  return data
}
export function loadLibrary(): { library: Library; error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return { library: raw ? parseBackup(JSON.parse(raw)) : sampleLibrary(), error: '' }
  } catch {
    return {
      library: {
        version: 1,
        books: [],
        series: [],
        loans: [],
        sermons: [],
        prayers: [],
        prayerSets: [],
        hymns: [],
        liturgies: [],
        notes: [],
        sample: false,
      },
      error:
        'Saved data could not be opened. It has not been overwritten. Export the stored data to recover it, or restore a valid backup.',
    }
  }
}
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([typeof value === 'string' ? value : JSON.stringify(value, null, 2)], {
      type: 'application/json',
    }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function importLogos(
  input: unknown,
  library: Library,
): { library: Library; added: number; skipped: number } {
  const records = z.array(z.record(z.string(), z.string())).min(1).parse(input)
  const next: Library = {
    ...library,
    books: library.books.filter((b) => !b.id.startsWith('sample-')),
    series: [...library.series],
    loans: library.loans.filter((l) => !l.bookId.startsWith('sample-')),
    sample: false,
  }
  let added = 0,
    skipped = 0
  for (const record of records) {
    if (!record['Resource ID'] || !record.Title?.trim())
      throw new Error('Each Logos record needs a Resource ID and Title.')
    if (
      next.books.some((b) => b.sourceId === record['Resource ID'] && b.source === 'Logos catalog')
    ) {
      skipped++
      continue
    }
    let series = next.series.find((s) => s.name === record.Series)
    if (record.Series && !series) {
      series = { id: crypto.randomUUID(), name: record.Series }
      next.series.push(series)
    }
    next.books.push({
      ...blankBook(),
      id: `logos:${record['Resource ID']}`,
      title: record.Title,
      author: record.Authors || '',
      publisher: record.Publishers || '',
      year: record['Publication Date'] || '',
      format: 'Logos',
      ownership: record.License === 'Permanent' ? 'Owned' : 'Not owned',
      license:
        record.License === 'Permanent'
          ? 'Permanent'
          : record.License === 'Temporary'
            ? 'Temporary'
            : 'Unknown',
      topics: (record.Subjects || '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean),
      seriesId: series?.id || '',
      source: 'Logos catalog',
      sourceId: record['Resource ID'],
      sourceMetadata: record,
    })
    added++
  }
  return { library: parseBackup(next), added, skipped }
}
