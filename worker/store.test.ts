import { describe, expect, it } from 'vitest'
import { applyChanges, readAll, validateChange } from './store'
import { handleApi } from './index'
import { fakeD1 } from './fakeD1.testing'

const rec = (id: string, title = 'A') => ({ kind: 'book', id, data: JSON.stringify({ id, title }) })

describe('shared library storage', () => {
  it('starts empty and stores only what is sent', async () => {
    const db = fakeD1()
    expect(await readAll(db)).toEqual({ revision: 0, records: [] })
    const result = await applyChanges(db, 0, { upserts: [rec('1'), rec('2')], deletes: [] })
    expect(result).toEqual({ ok: true, revision: 1 })
    expect((await readAll(db)).records).toHaveLength(2)
  })
  it('updates and deletes records', async () => {
    const db = fakeD1()
    await applyChanges(db, 0, { upserts: [rec('1'), rec('2')], deletes: [] })
    await applyChanges(db, 1, {
      upserts: [rec('1', 'Changed')],
      deletes: [{ kind: 'book', id: '2' }],
    })
    const { records, revision } = await readAll(db)
    expect(revision).toBe(2)
    expect(records).toHaveLength(1)
    expect(records[0].data).toContain('Changed')
  })
  it('refuses a save made from an out-of-date copy and changes nothing', async () => {
    const db = fakeD1()
    await applyChanges(db, 0, { upserts: [rec('1')], deletes: [] })
    const stale = await applyChanges(db, 0, {
      upserts: [rec('1', 'Old device'), rec('9')],
      deletes: [],
    })
    expect(stale).toEqual({ ok: false, revision: 1 })
    const { records } = await readAll(db)
    expect(records).toHaveLength(1)
    expect(records[0].data).not.toContain('Old device')
  })
  it('rejects malformed changes', () => {
    expect(() => validateChange({ upserts: [{ kind: 'Bad Kind', id: '1', data: '{}' }] })).toThrow()
    expect(() => validateChange({ upserts: [{ kind: 'book', id: '', data: '{}' }] })).toThrow()
    expect(() => validateChange({ upserts: [{ kind: 'book', id: '1', data: 'nope' }] })).toThrow()
    expect(() =>
      validateChange({ upserts: Array.from({ length: 401 }, (_, i) => rec(String(i))) }),
    ).toThrow()
  })
})

describe('shared library API', () => {
  const call = (env: object, path: string, init?: RequestInit) =>
    handleApi(new Request(`https://study.test${path}`, init), env as never)
  it('refuses everything until sign-in protection is configured', async () => {
    const response = await call({ DB: fakeD1() }, '/api/library')
    expect(response.status).toBe(503)
  })
  it('refuses requests without a valid sign-in token', async () => {
    const env = {
      DB: fakeD1(),
      STUDY_ACCESS_TEAM_DOMAIN: 't.cloudflareaccess.com',
      STUDY_ACCESS_AUD: 'a',
    }
    expect((await call(env, '/api/library')).status).toBe(401)
    const forged = await call(env, '/api/library', {
      headers: { 'Cf-Access-Jwt-Assertion': 'a.b.c' },
    })
    expect(forged.status).toBe(401)
  })
  it('saves and reads back when signed in, and returns 409 on stale saves', async () => {
    const env = { DB: fakeD1(), STUDY_DEV_NO_AUTH: '1' }
    const post = (baseRevision: number, upserts = [rec('1')]) =>
      call(env, '/api/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseRevision, upserts, deletes: [] }),
      })
    expect((await post(0)).status).toBe(200)
    expect((await post(0)).status).toBe(409)
    const library = (await (await call(env, '/api/library')).json()) as { revision: number }
    expect(library.revision).toBe(1)
  })
  it('requires JSON bodies', async () => {
    const env = { DB: fakeD1(), STUDY_DEV_NO_AUTH: '1' }
    const response = await call(env, '/api/changes', { method: 'POST', body: 'x=1' })
    expect(response.status).toBe(415)
  })
})
