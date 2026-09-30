import { describe, expect, it } from 'vitest'
import { blankNote } from './notes'
import { REFERENCE_IMAGES, NORMAL_IMAGES } from './attachments'
import type { Library } from './model'
import { biggest, fileKind, summaryLine, summarize, type Usage } from './usage'

const emptyLibrary = (): Library => ({
  version: 1,
  books: [],
  series: [],
  loans: [],
  sermons: [],
  prayers: [],
  prayerSets: [],
  notes: [],
  hymns: [],
  liturgies: [],
  resources: [],
  ideaSources: [],
  visuals: [],
  sample: false,
})
const file = (id: string, name: string, mime: string, size: number) => ({ id, name, mime, size })
const usage: Usage = {
  files: [
    file('a', 'hymnal.pdf', 'application/pdf', 5_000_000),
    file('b', 'lantern.jpg', 'image/jpeg', 700_000),
    file('c', 'card.jpg', 'image/jpeg', 300_000),
    file('d', 'tune.mp3', 'application/octet-stream', 2_000_000),
    file('e', 'talk.docx', 'application/octet-stream', 100_000),
  ],
  filesTruncated: false,
  records: { count: 40, bytes: 90_000 },
  manuscripts: { count: 3, bytes: 60_000 },
}
describe('space used', () => {
  it('sorts files into documents, images, music and video', () => {
    expect(fileKind(usage.files[0])).toBe('Documents')
    expect(fileKind(usage.files[1])).toBe('Images')
    expect(fileKind(usage.files[3])).toBe('Music & audio')
    expect(fileKind(file('x', 'clip.mp4', 'video/mp4', 1))).toBe('Video')
    expect(fileKind(usage.files[4])).toBe('Documents')
  })
  it('totals files and text and words the summary as documents, images and video', () => {
    const sum = summarize(usage)
    expect(sum.fileBytes).toBe(8_100_000)
    expect(sum.textBytes).toBe(150_000)
    expect(sum.total).toBe(8_250_000)
    expect(summaryLine(sum.rows)).toBe('2 documents · 2 images · 0 videos · 1 music or audio file')
  })
  it('names the record a big file belongs to', () => {
    const library = emptyLibrary()
    library.notes = [
      {
        ...blankNote('Illustration'),
        id: 'n',
        title: 'Lantern',
        attachments: [{ id: 'b', name: 'lantern.jpg', mime: 'image/jpeg', size: 1, addedAt: '' }],
      },
    ]
    const top = biggest(usage, library, 3)
    expect(top.map((f) => f.owner)).toEqual([
      'Not attached to anything',
      'Illustration: Lantern',
      'Not attached to anything',
    ])
  })
  it('keeps reference photos much smaller than ordinary ones', () => {
    expect(REFERENCE_IMAGES.cap).toBeLessThanOrEqual(1_000_000)
    expect(REFERENCE_IMAGES.longestSide).toBeLessThan(NORMAL_IMAGES.longestSide)
    expect(REFERENCE_IMAGES.keepAsIs).toBeLessThan(NORMAL_IMAGES.keepAsIs)
  })
})
