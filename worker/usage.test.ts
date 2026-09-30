import { describe, expect, it } from 'vitest'
import { putAttachment } from './attachments'
import { fakeD1 } from './fakeD1.testing'
import { applyChanges } from './store'
import { usageFor } from './usage'

const jpeg = (n: number) => {
  const b = new Uint8Array(n)
  b.set([0xff, 0xd8, 0xff])
  return b
}
describe('space used', () => {
  it('lists a person’s own files, biggest first, and counts their records', async () => {
    const db = fakeD1()
    await putAttachment(db, 'admin', 'aaaaaaaa1', 'small.jpg', 'image/jpeg', jpeg(1000))
    await putAttachment(db, 'admin', 'bbbbbbbb2', 'big.pdf', 'application/pdf', jpeg(9000))
    await putAttachment(db, 'someone@x.org', 'cccccccc3', 'theirs.jpg', 'image/jpeg', jpeg(500))
    await applyChanges(db, 'admin', 0, {
      upserts: [{ kind: 'note', id: 'n1', data: JSON.stringify({ title: 'A' }) }],
      deletes: [],
    })
    const usage = await usageFor(db, 'admin')
    expect(usage.files.map((f) => [f.name, f.size])).toEqual([
      ['big.pdf', 9000],
      ['small.jpg', 1000],
    ])
    expect(usage.filesTruncated).toBe(false)
    expect(usage.records).toEqual({ count: 1, bytes: 13 })
    expect(usage.manuscripts).toEqual({ count: 0, bytes: 0 })
  })
  it('reports zero, not an error, before anything has been stored', async () => {
    const usage = await usageFor(fakeD1(), 'admin')
    expect(usage).toEqual({
      files: [],
      filesTruncated: false,
      records: { count: 0, bytes: 0 },
      manuscripts: { count: 0, bytes: 0 },
    })
  })
})
