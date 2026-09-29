import { describe, expect, it } from 'vitest'
import type { Library } from './model'
import {
  buildPrayers,
  deletePrayer,
  parsePrayerFile,
  previewPrayerImport,
  savePrayer,
  searchPrayers,
  stripResponse,
  blankPrayer,
  categories,
  withNames,
} from './prayers'

const empty = (): Library => ({
  version: 1,
  books: [],
  series: [],
  loans: [],
  sermons: [],
  prayers: [],
  prayerSets: [],
  notes: [],
  sample: false,
})
// Invented text in the shape of the prayer builder file.
const FILE = `import { useState } from "react";

const LIBRARY = [{"id":"sick","name":"The Sick","description":"For the ill","prayers":[{"id":"sick_1","name":"Option A — First","text":"O God, we name [names] who are ill. Lord, in your mercy,"},{"id":"sick_2","name":"Option B — Second","text":"O God, hold the weary. Lord, in your mercy,"}]},{"id":"school","name":"Schools","description":"For the school","prayers":[{"id":"school_1","name":"Option A — Desks","text":"O God, bless the teachers with \\"patience\\" [name]. Lord, in your mercy,"}]}];

const STARTERS = {
  grace: "God of grace, we heard it again. Lord, in your mercy,",
  holy_spirit: "Come, Holy Spirit. Lord, in your mercy,",
};

const SYSTEM = \`unrelated\`;
export default function App() { return null }
`
describe('importing the prayer builder file', () => {
  const found = parsePrayerFile(FILE)
  it('reads categories, biddings and sermon starters', () => {
    expect(found).toMatchObject({ categories: 2, starters: 2 })
    expect(found.prayers).toHaveLength(5)
    const first = found.prayers[0]
    expect(first).toMatchObject({
      title: 'Option A — First',
      type: 'Bidding',
      category: 'The Sick',
      categoryKey: 'sick',
      sourceId: 'sick_1',
    })
    expect(first.text).toBe('O God, we name [names] who are ill.') // closing response removed, added once when building
    expect(found.prayers[2].text).toContain('"patience"')
    expect(found.prayers.filter((p) => p.type === 'Sermon starter').map((p) => p.title)).toEqual([
      'Grace',
      'Holy spirit',
    ])
  })
  it('reads the same data as plain JSON and rejects other files', () => {
    const json = JSON.stringify([
      {
        id: 'x',
        name: 'X',
        prayers: [{ id: 'x1', name: 'One', text: 'Hear us. Lord, in your mercy,' }],
      },
    ])
    expect(parsePrayerFile(json).prayers[0].text).toBe('Hear us.')
    expect(() => parsePrayerFile('const nothing = 1')).toThrow(/No prayer library/)
    expect(() => parsePrayerFile('[]')).toThrow(/empty/)
  })
  it('adds only what is new when imported again', () => {
    const once = previewPrayerImport(found, empty())
    expect(once).toMatchObject({ added: 5, skipped: 0 })
    const twice = previewPrayerImport(found, once.library)
    expect(twice).toMatchObject({ added: 0, skipped: 5 })
  })
})

describe('building the prayers of the church', () => {
  const library = previewPrayerImport(parsePrayerFile(FILE), empty()).library
  const id = (sourceId: string) => library.prayers.find((p) => p.sourceId === sourceId)!.id
  it('joins the chosen biddings with names filled in and the response once', () => {
    const text = buildPrayers(
      {
        date: '2026-09-27',
        sunday: 'Proper 21',
        scripture: 'Luke 16:19–31',
        selections: [
          { categoryKey: 'sick', prayerId: id('sick_1') },
          { categoryKey: 'school', prayerId: id('school_1') },
        ],
        names: { sick: 'Ann and Bob', grieving: '', birthdays: '' },
        other: 'For the flood victims.',
        petition: 'Lord of the poor, open our eyes. Lord, in your mercy,',
      },
      library.prayers,
    )
    expect(text).toBe(
      'PRAYERS OF THE CHURCH\nPROPER 21\nSeptember 27, 2026\nText: Luke 16:19–31\n\n' +
        'THE SICK\nO God, we name Ann and Bob who are ill.\nLord, in your mercy,\nHear our prayer.\n\n' +
        'SCHOOLS\nO God, bless the teachers with "patience" [name].\nLord, in your mercy,\nHear our prayer.\n\n' +
        'OTHER CONCERNS\nFor the flood victims.\n\n' +
        'SERMON-TIED PETITION\nLord of the poor, open our eyes.\nLord, in your mercy,\nHear our prayer.\n',
    )
    expect(text.match(/Lord, in your mercy,/g)).toHaveLength(3)
  })
  it('leaves placeholders when no names were given, and skips missing prayers', () => {
    expect(withNames('We name [names].', 'sick', { sick: '  ', grieving: '', birthdays: '' })).toBe(
      'We name [names].',
    )
    expect(
      withNames('We name [Names].', 'birthdays', { sick: '', grieving: '', birthdays: 'Dee' }),
    ).toBe('We name Dee.')
    expect(
      withNames('We name [names].', 'school', { sick: 'Ann', grieving: '', birthdays: '' }),
    ).toBe('We name [names].')
    const text = buildPrayers(
      {
        date: '',
        sunday: '',
        scripture: '',
        selections: [{ categoryKey: 'x', prayerId: 'gone' }],
        names: { sick: '', grieving: '', birthdays: '' },
        other: '',
        petition: '',
      },
      [],
    )
    expect(text).toBe('PRAYERS OF THE CHURCH\n')
    expect(stripResponse('A prayer.  Lord, in your mercy')).toBe('A prayer.')
  })
  it('lists categories in order, searches, edits and deletes', () => {
    expect(categories(library.prayers).map((c) => [c.name, c.count])).toEqual([
      ['The Sick', 2],
      ['Schools', 1],
    ])
    expect(searchPrayers(library.prayers, 'weary').map((p) => p.sourceId)).toEqual(['sick_2'])
    expect(searchPrayers(library.prayers, '', 'Schools')).toHaveLength(1)
    expect(searchPrayers(library.prayers, '', '', 'Sermon starter')).toHaveLength(2)
    expect(() => savePrayer(library, blankPrayer())).toThrow()
    const edited = savePrayer(library, { ...library.prayers[0], text: 'New words.' })
    expect(edited.prayers).toHaveLength(library.prayers.length)
    expect(edited.prayers[0].text).toBe('New words.')
    const withSet = {
      ...edited,
      prayerSets: [
        {
          id: 's',
          date: '',
          sunday: '',
          scripture: '',
          sermonId: '',
          selections: [{ categoryKey: 'sick', prayerId: library.prayers[0].id }],
          names: { sick: '', grieving: '', birthdays: '' },
          namesKept: false,
          other: '',
          petition: '',
          text: '',
          updatedAt: '',
        },
      ],
    }
    const removed = deletePrayer(withSet, library.prayers[0].id)
    expect(removed.prayers).toHaveLength(library.prayers.length - 1)
    expect(removed.prayerSets[0].selections).toEqual([])
  })
})
