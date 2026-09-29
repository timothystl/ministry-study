import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { docxText, matchFiles, readManuscript, sha256 } from './sermonText'
import { blankSermon, type Sermon } from './sermons'

const docx = (body: string) =>
  zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'word/document.xml': strToU8(
      `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${body}</w:body></w:document>`,
    ),
  })
const sermon = (over: Partial<Sermon>): Sermon => ({ ...blankSermon(), title: 'T', ...over })
const file = (name: string, content = 'x') => new File([content], name)

describe('reading Word files', () => {
  it('extracts paragraphs, tabs and breaks, and decodes entities', () => {
    const text = docxText(
      docx(
        '<w:p><w:r><w:t>Grace &amp; peace</w:t></w:r></w:p>' +
          '<w:p><w:r><w:t xml:space="preserve">One </w:t></w:r><w:r><w:t>sentence.</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>Tabbed</w:t></w:r></w:p>' +
          '<w:p/><w:p/><w:p/>' +
          '<w:p><w:r><w:t>Line</w:t><w:br/><w:t>break &#8220;quoted&#8221;</w:t></w:r></w:p>',
      ),
    )
    expect(text).toBe('Grace & peace\nOne sentence.\tTabbed\n\nLine\nbreak “quoted”')
  })
  it('leaves out text deleted in tracked changes', () => {
    const text = docxText(
      docx(
        '<w:p><w:r><w:t>Kept.</w:t></w:r><w:del w:id="1"><w:r><w:delText>Gone.</w:delText></w:r></w:del></w:p>',
      ),
    )
    expect(text).toBe('Kept.')
  })
  it('refuses files that are not Word documents', () => {
    expect(() => docxText(zipSync({ 'other.txt': strToU8('x') }))).toThrow(/Word document/)
  })
  it('reads text files, refuses empty and unsupported ones, and hashes the text', async () => {
    const m = await readManuscript(file('a.txt', 'Hello\r\nworld\r\n'))
    expect(m.text).toBe('Hello\nworld')
    expect(m.hash).toBe(await sha256('Hello\nworld'))
    expect(m.hash).toMatch(/^[a-f0-9]{64}$/)
    await expect(readManuscript(file('a.txt', '  '))).rejects.toThrow(/empty/)
    await expect(readManuscript(file('a.pdf'))).rejects.toThrow(/Word/)
    const fromDocx = await readManuscript(
      new File([docx('<w:p><w:r><w:t>Body.</w:t></w:r></w:p>')], 'b.docx'),
    )
    expect(fromDocx.text).toBe('Body.')
  })
})

describe('matching files to sermons', () => {
  const sermons = [
    sermon({
      id: 'a',
      title: 'The Lost Son',
      manuscript: 'OneDrive/2005-Current/0100_Lent 4_The Lost Son.docx',
      sourceId: '0100',
    }),
    sermon({
      id: 'b',
      title: 'Waves',
      manuscript: 'OneDrive/2005-Current/2006.04.01_Advent_Waves.docx',
      sourceId: '0020',
    }),
    sermon({ id: 'c', title: 'Wheat', manuscript: '', sourceId: '0200' }),
  ]
  it('matches by the recorded file name, ignoring case and folders', () => {
    const { matched, unmatched } = matchFiles(
      [file('0100_lent 4_the lost son.DOCX'), file('Something else.docx')],
      sermons,
    )
    expect(matched.map((m) => m.sermon.id)).toEqual(['a'])
    expect(unmatched.map((f) => f.name)).toEqual(['Something else.docx'])
  })
  it('matches a renamed file by its number when the title agrees, but not otherwise', () => {
    const renamed = matchFiles([file('0020_Class_Waves.docx')], sermons)
    expect(renamed.matched.map((m) => m.sermon.id)).toEqual(['b'])
    const wrongTitle = matchFiles([file('0020_Class_Something Unrelated.docx')], sermons)
    expect(wrongTitle.matched).toEqual([])
    expect(wrongTitle.unmatched).toHaveLength(1)
  })
  it('uses each sermon once and reports extra copies', () => {
    const { matched, duplicates } = matchFiles(
      [file('0100_Lent 4_The Lost Son.docx'), file('0100_Lent 4_The Lost Son.docx')],
      sermons,
    )
    expect(matched).toHaveLength(1)
    expect(duplicates).toHaveLength(1)
  })
})
