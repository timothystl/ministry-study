import { describe, expect, it } from 'vitest'
import type { Library } from './model'
import { blankSermon } from './sermons'
import {
  blankVisual,
  creditLine,
  embedUrl,
  isCleared,
  parseVideo,
  saveVisual,
  searchVisuals,
  seconds,
  thumbnailUrl,
  visualFromLink,
  visualsForSermon,
  visualSources,
} from './visuals'

const empty = (): Library => ({
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
const v = (over: Partial<ReturnType<typeof blankVisual>>) => ({
  ...blankVisual(),
  title: 'T',
  ...over,
})

describe('clip times and players', () => {
  it('reads minutes and seconds', () => {
    expect(seconds('1:05')).toBe(65)
    expect(seconds('1:02:03')).toBe(3723)
    expect(seconds('90')).toBe(90)
    expect(seconds('')).toBeNull()
    expect(seconds('soon')).toBeNull()
  })
  it('recognizes YouTube and Vimeo links and nothing else', () => {
    expect(parseVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toEqual({
      site: 'YouTube',
      id: 'dQw4w9WgXcQ',
    })
    expect(parseVideo('https://youtu.be/dQw4w9WgXcQ')).toEqual({
      site: 'YouTube',
      id: 'dQw4w9WgXcQ',
    })
    expect(parseVideo('https://youtube.com/shorts/dQw4w9WgXcQ')).toEqual({
      site: 'YouTube',
      id: 'dQw4w9WgXcQ',
    })
    expect(parseVideo('https://vimeo.com/123456789')).toEqual({ site: 'Vimeo', id: '123456789' })
    expect(parseVideo('https://example.org/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(parseVideo('not a link')).toBeNull()
  })
  it('opens the player at the clip’s start and stops at its end', () => {
    const yt = parseVideo('https://youtu.be/dQw4w9WgXcQ')!
    expect(embedUrl(yt, '1:05', '2:00')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&start=65&end=120',
    )
    expect(embedUrl(yt, '', '')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0')
    expect(embedUrl(parseVideo('https://vimeo.com/123456789')!, '0:30', '')).toBe(
      'https://player.vimeo.com/video/123456789#t=30s',
    )
    expect(thumbnailUrl(yt)).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })
})

describe('keeping images and clips', () => {
  it('needs a title, link or photo, and checks the link and the times', () => {
    expect(() => saveVisual(empty(), blankVisual())).toThrow(/title, a link or a photo/)
    expect(() => saveVisual(empty(), v({ link: 'ftp://x' }))).toThrow(/http/)
    expect(() => saveVisual(empty(), v({ start: 'soon' }))).toThrow(/start/)
    expect(() => saveVisual(empty(), v({ start: '2:00', end: '1:00' }))).toThrow(/after the start/)
    const saved = saveVisual(
      empty(),
      v({ title: '', link: 'https://example.org/img/lantern-in-dark.jpg' }),
    )
    expect(saved.visuals[0].title).toBe('Lantern in dark')
  })
  it('turns a pasted link into a clip or a photo', () => {
    expect(visualFromLink('https://youtu.be/dQw4w9WgXcQ').kind).toBe('Clip')
    expect(visualFromLink('https://example.org/a/harbor.jpg').kind).toBe('Photo')
  })
  it('knows which licenses are cleared for display, and builds a credit line', () => {
    expect(isCleared('Public domain')).toBe(true)
    expect(isCleared('CVLI (church license)')).toBe(true)
    expect(isCleared('Reference only')).toBe(false)
    expect(isCleared('Unknown')).toBe(false)
    expect(
      creditLine(
        v({
          title: 'Harbor',
          creator: 'A. Painter',
          license: 'Public domain',
          link: 'https://x.org/h',
        }),
      ),
    ).toBe('“Harbor” by A. Painter, Public domain. https://x.org/h')
    expect(creditLine(v({ title: 'Harbor', credit: 'Photo: Sam Lee' }))).toBe('Photo: Sam Lee')
  })
  it('searches words and passages, with filters, and finds what belongs to a sermon', () => {
    const list = [
      v({
        id: 'a',
        title: 'Prodigal painting',
        scripture: 'Luke 15:11–32',
        kind: 'Painting or art',
        license: 'Public domain',
        useFor: ['Sermon slide'],
      }),
      v({
        id: 'b',
        title: 'Storm scene',
        kind: 'Clip',
        happens: 'The boat is tossed',
        license: 'CVLI (church license)',
      }),
    ]
    const ids = (q: string, f = {}) => searchVisuals(list, q, f).map((h) => h.visual.id)
    expect(ids('Luke 15')).toEqual(['a'])
    expect(ids('boat')).toEqual(['b'])
    expect(ids('', { kind: 'Clip' })).toEqual(['b'])
    expect(ids('', { license: 'Public domain' })).toEqual(['a'])
    expect(ids('', { useFor: 'Sermon slide' })).toEqual(['a'])
    const sermon = { ...blankSermon(), scripture: 'Luke 15:20' }
    expect(visualsForSermon({ ...empty(), visuals: list }, sermon).map((x) => x.id)).toEqual(['a'])
  })
  it('offers places to look, each limited to open sources', () => {
    expect(visualSources.map((s) => s.name)).toContain('Wikimedia Commons')
    expect(visualSources[0].url('good shepherd')).toContain('good%20shepherd')
  })
})
