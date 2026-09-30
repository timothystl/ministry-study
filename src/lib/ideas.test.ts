import { describe, expect, it } from 'vitest'
import { blankNote } from './notes'
import {
  addSource,
  allSources,
  builtInSources,
  cleanSite,
  isWebLink,
  linkTitle,
  noteFromLink,
  parseLinks,
  searchUrl,
} from './ideas'

describe('finding illustrations elsewhere', () => {
  it('limits a search to one site', () => {
    expect(searchUrl(builtInSources[0], 'Luke 15')).toBe(
      'https://duckduckgo.com/?q=site%3Atextweek.com%20Luke%2015',
    )
    expect(builtInSources.map((s) => s.name)).toEqual([
      'TextWeek',
      'The Salt Project',
      'RW360',
      'Cardiphonia',
      'Working Preacher',
      'Christian Century',
      'Sojourners',
    ])
  })
  it('adds a site of your own, cleaned up, and refuses repeats and non-addresses', () => {
    expect(cleanSite(' https://www.Example.org/blog/?x=1 ')).toBe('example.org/blog')
    const list = addSource([], 'Example', 'https://www.example.org/blog/')
    expect(list).toMatchObject([{ name: 'Example', site: 'example.org/blog' }])
    expect(addSource([], '', 'example.org')[0].name).toBe('example.org')
    expect(() => addSource(list, 'Again', 'example.org/blog')).toThrow(/already/)
    expect(() => addSource([], 'RW', 'rw360.org')).toThrow(/already/)
    expect(() => addSource([], 'x', 'not an address')).toThrow(/web address/)
    expect(allSources(list)).toHaveLength(builtInSources.length + 1)
  })
  it('turns a link into a titled item that keeps the link', () => {
    expect(linkTitle('https://rw360.org/blog/the-lost-son-again/')).toEqual({
      title: 'The lost son again',
      site: 'rw360.org',
    })
    expect(linkTitle('https://www.saltproject.org/').title).toBe('saltproject.org')
    const n = noteFromLink('https://rw360.org/blog/small-mercies', 'Good for Lent 3')
    expect(n).toMatchObject({
      kind: 'Illustration',
      source: 'https://rw360.org/blog/small-mercies',
      body: 'Good for Lent 3',
      tags: ['rw360.org'],
    })
    expect(isWebLink('not a link')).toBe(false)
  })
  it('reads a pasted list of links, skipping repeats and non-links', () => {
    const have = [{ ...blankNote('Idea'), source: 'https://rw360.org/blog/a' }]
    const { ready, skipped } = parseLinks(
      [
        'https://rw360.org/blog/a',
        'https://rw360.org/blog/b | keep',
        'hello',
        '',
        'https://rw360.org/blog/b',
      ].join('\n'),
      have,
    )
    expect(ready.map((n) => [n.title, n.body])).toEqual([['B', 'keep']])
    expect(skipped).toHaveLength(3)
  })
})
