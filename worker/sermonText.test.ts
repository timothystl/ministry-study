import { describe, expect, it } from 'vitest'
import { fakeD1 } from './fakeD1.testing'
import { handleApi } from './index'
import {
  deleteText,
  exportAll,
  ftsQuery,
  getText,
  listStatus,
  putText,
  searchText,
  setIndexed,
  validateText,
} from './sermonText'

const input = (text: string, over = {}) => ({
  text,
  hash: 'abcdef12',
  fileName: 'a.docx',
  indexed: true,
  ...over,
})

describe('sermon text storage', () => {
  it('stores text, replaces it, and reports status', async () => {
    const db = fakeD1()
    await putText(db, 'admin', 's1', input('The prodigal son came home.'))
    await putText(
      db,
      'admin',
      's1',
      input('A different manuscript entirely.', { hash: '12345678' }),
    )
    expect(await getText(db, 'admin', 's1')).toMatchObject({
      text: 'A different manuscript entirely.',
      hash: '12345678',
      indexed: true,
    })
    expect(await listStatus(db, 'admin')).toEqual([
      { id: 's1', chars: 32, hash: '12345678', indexed: true },
    ])
    expect(await searchText(db, 'admin', 'prodigal')).toEqual([])
    expect((await searchText(db, 'admin', 'entirely')).map((h) => h.id)).toEqual(['s1'])
  })
  it('searches whole words with stemming, phrases, and highlights the match', async () => {
    const db = fakeD1()
    await putText(db, 'admin', 'a', input('The son returned home and the father ran to meet him.'))
    await putText(db, 'admin', 'b', input('A sower went out to sow. Some seed fell on the path.'))
    expect((await searchText(db, 'admin', 'son returning')).map((h) => h.id)).toEqual(['a'])
    expect((await searchText(db, 'admin', '"father ran"')).map((h) => h.id)).toEqual(['a'])
    expect((await searchText(db, 'admin', '"ran father"')).map((h) => h.id)).toEqual([])
    const [hit] = await searchText(db, 'admin', 'seed')
    expect(hit).toMatchObject({ id: 'b' })
    expect(hit.snippet).toContain('[[seed]]')
  })
  it('never lets punctuation break a search', async () => {
    const db = fakeD1()
    await putText(db, 'admin', 'a', input("God's grace is enough."))
    expect(ftsQuery('grace* OR (NOT enough)')).toBe('"grace" AND "OR" AND "NOT" AND "enough"')
    expect(await searchText(db, 'admin', 'grace"; DROP TABLE x;--')).toEqual([])
    expect((await searchText(db, 'admin', "God's grace")).map((h) => h.id)).toEqual(['a'])
    expect(await searchText(db, 'admin', '   ')).toEqual([])
  })
  it('keeps text but leaves a private sermon out of search, and can change its mind', async () => {
    const db = fakeD1()
    await putText(
      db,
      'admin',
      'p',
      input('A funeral sermon with private details.', { indexed: false }),
    )
    expect(await searchText(db, 'admin', 'funeral')).toEqual([])
    expect((await getText(db, 'admin', 'p'))?.text).toContain('funeral')
    expect(await setIndexed(db, 'admin', 'p', true)).toBe(true)
    expect((await searchText(db, 'admin', 'funeral')).map((h) => h.id)).toEqual(['p'])
    expect((await getText(db, 'admin', 'p'))?.hash).toBe('abcdef12')
    await setIndexed(db, 'admin', 'p', false)
    expect(await searchText(db, 'admin', 'funeral')).toEqual([])
    expect(await setIndexed(db, 'admin', 'missing', true)).toBe(false)
  })
  it('deletes text and its index, and exports in pages', async () => {
    const db = fakeD1()
    for (const id of ['a', 'b', 'c']) await putText(db, 'admin', id, input(`Text of ${id}.`))
    await deleteText(db, 'admin', 'b')
    expect(await searchText(db, 'admin', 'text b')).toEqual([])
    expect((await exportAll(db, 'admin', '', 1)).map((r) => r.id)).toEqual(['a'])
    expect((await exportAll(db, 'admin', 'a', 5)).map((r) => r.id)).toEqual(['c'])
  })
  it('rejects bad input', () => {
    expect(() => validateText({ text: '  ', hash: 'abcdef12' })).toThrow()
    expect(() => validateText({ text: 'x', hash: 'nope!' })).toThrow()
    expect(() => validateText({ text: 'x'.repeat(600_001), hash: 'abcdef12' })).toThrow(/too long/)
  })
})

describe('sermon text API', () => {
  const env = () => ({ DB: fakeD1(), STUDY_DEV_NO_AUTH: '1' })
  const call = (e: object, path: string, init?: RequestInit) =>
    handleApi(new Request(`https://study.test${path}`, init), e as never)
  const json = (body: unknown, method = 'PUT') => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  it('saves, reads, searches, changes indexing, exports and deletes', async () => {
    const e = env()
    expect((await call(e, '/api/sermon-text/abc-1', json(input('Grace upon grace.')))).status).toBe(
      200,
    )
    expect(await (await call(e, '/api/sermon-text/abc-1')).json()).toMatchObject({
      text: 'Grace upon grace.',
    })
    expect(await (await call(e, '/api/sermon-text')).json()).toHaveLength(1)
    const hits = (await (await call(e, '/api/sermon-search?q=grace')).json()) as { id: string }[]
    expect(hits[0].id).toBe('abc-1')
    expect(
      (await call(e, '/api/sermon-text/abc-1', json({ indexed: false }, 'PATCH'))).status,
    ).toBe(200)
    expect(await (await call(e, '/api/sermon-search?q=grace')).json()).toEqual([])
    expect(await (await call(e, '/api/sermon-export')).json()).toHaveLength(1)
    expect((await call(e, '/api/sermon-text/abc-1', { method: 'DELETE' })).status).toBe(200)
    expect((await call(e, '/api/sermon-text/abc-1')).status).toBe(404)
  })
  it('refuses bad ids, missing sign-in, and non-JSON bodies', async () => {
    const e = env()
    expect((await call(e, '/api/sermon-text/bad id!', json(input('x')))).status).toBe(400)
    expect((await call(e, '/api/sermon-text/a', { method: 'PUT', body: 'x' })).status).toBe(415)
    expect((await call(e, '/api/sermon-text/a', json({ text: '' }))).status).toBe(400)
    const closed = { DB: fakeD1(), STUDY_ACCESS_TEAM_DOMAIN: 't.example', STUDY_ACCESS_AUD: 'a' }
    expect((await call(closed, '/api/sermon-search?q=x')).status).toBe(401)
    expect((await call({ DB: fakeD1() }, '/api/sermon-text')).status).toBe(503)
  })
})

describe('manuscripts are private to each person', () => {
  it('never shows one person’s text, search or export to another', async () => {
    const db = fakeD1()
    await putText(db, 'admin', 's1', input('Grace upon grace, said the pastor.'))
    await putText(db, 'g@x.org', 's1', input('Grace and peace, said the guest.'))
    expect((await getText(db, 'g@x.org', 's1'))?.text).toContain('guest')
    expect((await searchText(db, 'admin', 'grace')).map((h) => h.id)).toEqual(['s1'])
    expect((await searchText(db, 'g@x.org', 'pastor')).map((h) => h.id)).toEqual([])
    expect((await exportAll(db, 'g@x.org')).map((r) => r.text)).toEqual([
      'Grace and peace, said the guest.',
    ])
    await deleteText(db, 'g@x.org', 's1')
    expect(await getText(db, 'g@x.org', 's1')).toBeUndefined()
    expect((await getText(db, 'admin', 's1'))?.text).toContain('pastor')
    expect((await searchText(db, 'admin', 'pastor')).map((h) => h.id)).toEqual(['s1'])
  })
  it('keeps and re-indexes manuscripts saved before people were added', async () => {
    const db = fakeD1()
    await db.batch([
      db.prepare(
        `CREATE TABLE sermon_text (sermon_id TEXT PRIMARY KEY, body TEXT NOT NULL,
          chars INTEGER NOT NULL, hash TEXT NOT NULL, file_name TEXT NOT NULL,
          indexed INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)`,
      ),
      db.prepare(
        `CREATE VIRTUAL TABLE sermon_fts USING fts5(body, sermon_id UNINDEXED, tokenize = 'porter unicode61')`,
      ),
      db.prepare(
        `INSERT INTO sermon_text VALUES ('old', 'The lost sheep was found.', 25, 'abcdef12', 'f.md', 1, 't')`,
      ),
      db.prepare(
        `INSERT INTO sermon_text VALUES ('quiet', 'A private funeral text.', 23, 'abcdef12', 'g.md', 0, 't')`,
      ),
      db.prepare(
        `INSERT INTO sermon_fts (body, sermon_id) VALUES ('The lost sheep was found.', 'old')`,
      ),
    ])
    expect((await searchText(db, 'admin', 'sheep')).map((h) => h.id)).toEqual(['old'])
    expect((await searchText(db, 'admin', 'funeral')).map((h) => h.id)).toEqual([])
    expect((await getText(db, 'admin', 'quiet'))?.text).toContain('funeral')
    expect(await searchText(db, 'g@x.org', 'sheep')).toEqual([])
  })
})
