import { describe, expect, it } from 'vitest'
import { attachmentType, sizeLabel } from './attachments'

describe('attachments', () => {
  it('recognizes photos and PDFs, by type or by ending', () => {
    expect(attachmentType({ type: 'application/pdf', name: 'a' })).toBe('application/pdf')
    expect(attachmentType({ type: '', name: 'Scan.PDF' })).toBe('application/pdf')
    expect(attachmentType({ type: '', name: 'page.jpeg' })).toBe('image/jpeg')
    expect(attachmentType({ type: 'image/heic', name: 'IMG.HEIC' })).toBe('image/other')
    expect(attachmentType({ type: 'text/plain', name: 'a.txt' })).toBe('')
    expect(attachmentType({ type: '', name: 'song.musx' })).toBe('')
  })
  it('describes sizes plainly', () => {
    expect(sizeLabel(2_400_000)).toBe('2.4 MB')
    expect(sizeLabel(48_000)).toBe('48 KB')
    expect(sizeLabel(10)).toBe('1 KB')
  })
})
