import { describe, expect, it } from 'vitest'
import {
  checkUpload,
  deleteAttachment,
  fromBase64,
  getAttachment,
  putAttachment,
  sniff,
  toBase64,
} from './attachments'
import { fakeD1 } from './fakeD1.testing'
import { handleApi } from './index'

const png = () => {
  const b = new Uint8Array(1_500_000) // several pieces once encoded
  b.set([0x89, 0x50, 0x4e, 0x47])
  for (let i = 4; i < b.length; i++) b[i] = i % 251
  return b
}
const same = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((v, i) => v === b[i])
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])

describe('attachments', () => {
  it('round-trips bytes through base64', () => {
    const b = png()
    expect(same(fromBase64(toBase64(b)), b)).toBe(true)
  })
  it('accepts photos and PDFs by what they really are, and refuses the rest', () => {
    expect(sniff(pdf)).toBe('application/pdf')
    expect(checkUpload(pdf, 'application/pdf')).toBe('application/pdf')
    expect(() => checkUpload(pdf, 'image/png')).toThrow(/not the kind/)
    expect(() => checkUpload(new Uint8Array([60, 104, 116, 109, 108]), 'text/html')).toThrow(
      /Only photos/,
    )
    expect(() => checkUpload(new Uint8Array(), 'image/png')).toThrow(/empty/)
    expect(() => checkUpload(new Uint8Array(8_000_001), 'application/pdf')).toThrow(/too large/)
  })
  it('accepts music, slide and Finale files by their ending, checking what they start like', () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])
    const mp3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0])
    expect(checkUpload(zip, 'application/octet-stream', 'Advent.pptx')).toBe(
      'application/octet-stream',
    )
    expect(checkUpload(zip, '', 'Abide.musx')).toBe('application/octet-stream')
    expect(checkUpload(new Uint8Array([9, 9, 9]), '', 'old.MUS')).toBe('application/octet-stream')
    expect(checkUpload(mp3, 'application/octet-stream', 'demo.mp3')).toBe(
      'application/octet-stream',
    )
    expect(() => checkUpload(new Uint8Array([1, 2, 3]), '', 'Advent.pptx')).toThrow(/name says/)
    expect(() => checkUpload(zip, '', 'run.exe')).toThrow(/Only photos/)
    expect(() => checkUpload(zip, 'text/html', 'Advent.pptx')).toThrow(/Only photos/)
    expect(() => checkUpload(new Uint8Array([1, 2]), '', 'demo.mp3')).toThrow(/name says/)
  })
  it('stores a large file in pieces and returns it whole; delete removes it', async () => {
    const db = fakeD1()
    const b = png()
    await putAttachment(db, 'admin', 'abcdefgh', 'page.png', 'image/png', b)
    const got = await getAttachment(db, 'admin', 'abcdefgh')
    expect(got).toMatchObject({ name: 'page.png', mime: 'image/png', size: b.length })
    expect(got!.pieces).toBeGreaterThan(2)
    expect(same(got!.bytes, b)).toBe(true)
    await putAttachment(db, 'admin', 'abcdefgh', 'again.pdf', 'application/pdf', pdf)
    expect(same((await getAttachment(db, 'admin', 'abcdefgh'))!.bytes, pdf)).toBe(true)
    await deleteAttachment(db, 'admin', 'abcdefgh')
    expect(await getAttachment(db, 'admin', 'abcdefgh')).toBeNull()
  })
  it('keeps each person’s files private, even if an id is guessed', async () => {
    const db = fakeD1()
    await putAttachment(db, 'admin', 'abcdefgh', 'mine.pdf', 'application/pdf', pdf)
    expect(await getAttachment(db, 'g@x.org', 'abcdefgh')).toBeNull()
    expect(
      await putAttachment(db, 'g@x.org', 'abcdefgh', 'theirs.pdf', 'application/pdf', pdf),
    ).toBe(false)
    await deleteAttachment(db, 'g@x.org', 'abcdefgh')
    expect((await getAttachment(db, 'admin', 'abcdefgh'))?.name).toBe('mine.pdf')
  })
  it('gives files saved before people were added to the pastor', async () => {
    const db = fakeD1()
    await db.batch([
      db.prepare(
        `CREATE TABLE attachment (id TEXT PRIMARY KEY, name TEXT NOT NULL, mime TEXT NOT NULL,
          size INTEGER NOT NULL, pieces INTEGER NOT NULL, created_at TEXT NOT NULL)`,
      ),
      db.prepare(
        `CREATE TABLE attachment_piece (id TEXT NOT NULL, seq INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (id, seq))`,
      ),
      db.prepare(
        `INSERT INTO attachment VALUES ('oldfile01', 'old.pdf', 'application/pdf', 3, 1, 't')`,
      ),
      db.prepare(`INSERT INTO attachment_piece VALUES ('oldfile01', 0, 'AAEC')`),
    ])
    expect((await getAttachment(db, 'admin', 'oldfile01'))?.name).toBe('old.pdf')
    expect(await getAttachment(db, 'g@x.org', 'oldfile01')).toBeNull()
  })
})

describe('attachment routes', () => {
  const env = (db: D1Database) =>
    ({
      DB: db,
      ASSETS: {} as Fetcher,
      STUDY_ACCESS_TEAM_DOMAIN: '',
      STUDY_ACCESS_AUD: '',
    }) as never
  it('needs sign-in like every other route', async () => {
    const res = await handleApi(new Request('https://x/api/attachments/abcdefgh'), env(fakeD1()))
    expect([401, 503]).toContain(res.status)
  })
})
