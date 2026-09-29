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
    await putText(db, 's1', input('The prodigal son came home.'))
    await putText(db, 's1', input('A different manuscript entirely.', { hash: '12345678' }))
    expect(await getText(db, 's1')).toMatchObject({
      text: 'A different manuscript entirely.',
      hash: '12345678',
      indexed: true,
    })
    expect(await listStatus(db)).toEqual([{ id: 's1', chars: 32, hash: '12345678', indexed: true }])
    expect(await searchText(db, 'prodigal')).toEqual([])
    expect((await searchText(db, 'entirely')).map((h) => h.id)).toEqual(['s1'])
  })
  it('searches whole words with stemming, phrases, and highlights the match', async () => {
    const db = fakeD1()
    await putText(db, 'a', input('The son returned home and the father ran to meet him.'))
    await putText(db, 'b', input('A sower went out to sow. Some seed fell on the path.'))
    expect((await searchText(db, 'son returning')).map((h) => h.id)).toEqual(['a'])
    expect((await searchText(db, '"father ran"')).map((h) => h.id)).toEqual(['a'])
    expect((await searchText(db, '"ran father"')).map((h) => h.id)).toEqual([])
    const [hit] = await searchText(db, 'seed')
    expect(hit).toMatchObject({ id: 'b' })
    expect(hit.snippet).toContain('[[seed]]')
  })
  it('never lets punctuation break a search', async () => {
    const db = fakeD1()
    await putText(db, 'a', input("God's grace is enough."))
    expect(ftsQuery('grace* OR (NOT enough)')).toBe('"grace" AND "OR" AND "NOT" AND "enough"')
    expect(await searchText(db, 'grace"; DROP TABLE x;--')).toEqual([])
    expect((await searchText(db, "God's grace")).map((h) => h.id)).toEqual(['a'])
    expect(await searchText(db, '   ')).toEqual([])
  })
  it('keeps text but leaves a private sermon out of search, and can change its mind', async () => {
    const db = fakeD1()
    await putText(db, 'p', input('A funeral sermon with private details.', { indexed: false }))
    expect(await searchText(db, 'funeral')).toEqual([])
    expect((await getText(db, 'p'))?.text).toContain('funeral')
    expect(await setIndexed(db, 'p', true)).toBe(true)
    expect((await searchText(db, 'funeral')).map((h) => h.id)).toEqual(['p'])
    expect((await getText(db, 'p'))?.hash).toBe('abcdef12')
    await setIndexed(db, 'p', false)
    expect(await searchText(db, 'funeral')).toEqual([])
    expect(await setIndexed(db, 'missing', true)).toBe(false)
  })
  it('deletes text and its index, and exports in pages', async () => {
    const db = fakeD1()
    for (const id of ['a', 'b', 'c']) await putText(db, id, input(`Text of ${id}.`))
    await deleteText(db, 'b')
    expect(await searchText(db, 'text b')).toEqual([])
    expect((await exportAll(db, '', 1)).map((r) => r.id)).toEqual(['a'])
    expect((await exportAll(db, 'a', 5)).map((r) => r.id)).toEqual(['c'])
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
