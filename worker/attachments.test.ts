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
    expect(() => checkUpload(new Uint8Array(6_000_001), 'application/pdf')).toThrow(/too large/)
  })
  it('stores a large file in pieces and returns it whole; delete removes it', async () => {
    const db = fakeD1()
    const b = png()
    await putAttachment(db, 'abcdefgh', 'page.png', 'image/png', b)
    const got = await getAttachment(db, 'abcdefgh')
    expect(got).toMatchObject({ name: 'page.png', mime: 'image/png', size: b.length })
    expect(got!.pieces).toBeGreaterThan(2)
    expect(same(got!.bytes, b)).toBe(true)
    await putAttachment(db, 'abcdefgh', 'again.pdf', 'application/pdf', pdf)
    expect(same((await getAttachment(db, 'abcdefgh'))!.bytes, pdf)).toBe(true)
    await deleteAttachment(db, 'abcdefgh')
    expect(await getAttachment(db, 'abcdefgh')).toBeNull()
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
