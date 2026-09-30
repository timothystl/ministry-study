import { describe, expect, it } from 'vitest'
import { findPrayers, parseIndex, splitForms } from './lcms'
import { plainWordText, readWordText } from './wordDoc'
import { makeWordDoc } from './wordDoc.testing'

// Invented text in the shape of an LCMS file.
const TEXT = [
  'Prayer of the Church \u000b Responsive Form',
  'Third Sunday of Testing (Proper 99A)',
  '4 October 2026',
  '',
  'Let us pray for the church.',
  '',
  'Gracious Lord, keep Your people’s hope. Bless _____________, our pastor. Lord, in Your mercy, hear our prayer.',
  '',
  'Prayer of the Church \u000b Ektene Form',
  'Third Sunday of Testing (Proper 99A)',
  '4 October 2026',
  '',
  'In peace, let us pray to the Lord: Lord, have mercy.',
].join('\r')
const INDEX = `<ul>
<li><strong>Oct. 4, 2026</strong> &mdash; <a class="no-icon" href="https://files.lcms.org/dl/f/series-a-prayers-10-4-2026" target="_blank">Third Sunday of Testing</a></li>
<li><strong>Sept. 29, 2026</strong> &mdash; <a href="https://files.lcms.org/dl/f/series-a-prayers-9-29-2026-st-michael">St. Michael &amp; All Angels</a></li>
<li><strong>Oct. 4, 2026</strong> &mdash; <a href="https://evil.example/x">Not an LCMS file</a></li>
</ul>`

describe('reading a Word file', () => {
  it('reads the text and turns Word controls into plain paragraphs', () => {
    const text = plainWordText(readWordText(makeWordDoc(TEXT)))
    expect(text).toContain('Prayer of the Church\n Responsive Form')
    expect(text).toContain('keep Your people’s hope')
  })
  it('refuses a file that is not a Word document', () => {
    expect(() => readWordText(new Uint8Array(1000))).toThrow('not a Word document')
  })
})

describe('the LCMS index and files', () => {
  it('finds each Sunday and ignores links that are not LCMS files', () => {
    expect(parseIndex(INDEX)).toEqual([
      {
        date: '2026-10-04',
        title: 'Third Sunday of Testing',
        url: 'https://files.lcms.org/dl/f/series-a-prayers-10-4-2026',
      },
      {
        date: '2026-09-29',
        title: 'St. Michael & All Angels',
        url: 'https://files.lcms.org/dl/f/series-a-prayers-9-29-2026-st-michael',
      },
    ])
  })
  it('splits the responsive and ektene forms without the repeated title and date', () => {
    const forms = splitForms(plainWordText(readWordText(makeWordDoc(TEXT))))
    expect(forms.responsive.startsWith('Let us pray for the church.')).toBe(true)
    expect(forms.responsive).toContain('Lord, in Your mercy, hear our prayer.')
    expect(forms.responsive).not.toContain('Ektene')
    expect(forms.ektene).toBe('In peace, let us pray to the Lord: Lord, have mercy.')
  })
  it('finds the prayers for a date, and none for a date without one', async () => {
    const get = async (url: string) =>
      url.includes('worship')
        ? new Response(INDEX)
        : new Response(makeWordDoc(TEXT) as BodyInit, { status: 200 })
    const found = await findPrayers('2026-10-04', 'three', get)
    expect(found).toHaveLength(1)
    expect(found[0].title).toBe('Third Sunday of Testing')
    expect(found[0].ektene).toContain('Lord, have mercy')
    expect(await findPrayers('2026-01-01', 'three', get)).toEqual([])
  })
})
