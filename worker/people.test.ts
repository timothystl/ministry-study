import { describe, expect, it } from 'vitest'
import { handleApi } from './index'
import { fakeD1 } from './fakeD1.testing'
import { cleanSections, kindsFor } from './sections'
import { listPeople, resolveWho, savePerson, validatePerson } from './people'

describe('parts of the app', () => {
  it('maps parts to the record kinds they own', () => {
    expect(kindsFor(['library'])).toEqual(['book', 'series', 'loan'])
    expect(kindsFor(['notes', 'children'])).toEqual(['note'])
    expect(kindsFor(['hymns'])).toEqual(['hymn', 'liturgy', 'resource'])
    expect(kindsFor([])).toEqual([])
    expect(cleanSections(['sermons', 'nonsense', 'library'])).toEqual(['library', 'sermons'])
  })
  it('rejects unknown parts and missing choices', () => {
    expect(() => validatePerson({ name: 'A', sections: ['everything'] })).toThrow()
    expect(() => validatePerson({ name: 'A' })).toThrow()
    expect(validatePerson({ name: ' Sam ', sections: ['prayers'] })).toEqual({
      name: 'Sam',
      sections: ['prayers'],
      active: true,
    })
  })
})

describe('who is asking', () => {
  it('gives the pastor everything, and strangers nothing', async () => {
    const db = fakeD1()
    const pastor = await resolveWho(db, 'Pastor@Church.org', 'pastor@church.org', false)
    expect(pastor).toMatchObject({ ok: true, who: { role: 'admin', owner: 'admin', kinds: null } })
    expect(await resolveWho(db, 'guest@x.org', 'pastor@church.org', false)).toEqual({
      ok: false,
      reason: 'not-added',
    })
  })
  it('limits an added person to their parts, and stops a paused one', async () => {
    const db = fakeD1()
    await savePerson(db, 'guest@x.org', { name: 'Guest', sections: ['prayers'], active: true })
    const found = await resolveWho(db, 'GUEST@x.org', 'pastor@church.org', false)
    expect(found).toMatchObject({
      ok: true,
      who: { role: 'user', owner: 'guest@x.org', kinds: ['prayer', 'prayerset'] },
    })
    await savePerson(db, 'guest@x.org', { name: 'Guest', sections: ['prayers'], active: false })
    expect(await resolveWho(db, 'guest@x.org', 'pastor@church.org', false)).toEqual({
      ok: false,
      reason: 'paused',
    })
    expect((await listPeople(db)).map((p) => p.email)).toEqual(['guest@x.org'])
  })
})

describe('people and permissions over the API', () => {
  const admin = 'pastor@church.org'
  const make = () => {
    const env = { DB: fakeD1(), STUDY_ADMIN_EMAIL: admin }
    // Stands in for the Cloudflare Access sign-in check.
    const as = (email: string) => (path: string, init?: RequestInit) =>
      handleApi(new Request(`https://study.test${path}`, init), env as never, async () => ({
        status: 'ok' as const,
        email,
      }))
    return { env, as }
  }
  const json = (body: unknown, method = 'PUT') => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const book = { kind: 'book', id: 'b1', data: '{"id":"b1"}' }
  const prayer = { kind: 'prayer', id: 'p1', data: '{"id":"p1"}' }
  const save = (call: ReturnType<ReturnType<typeof make>['as']>, upserts: object[], base = 0) =>
    call('/api/changes', json({ baseRevision: base, upserts, deletes: [] }, 'POST'))

  it('local development without sign-in acts as the pastor', async () => {
    const env = { DB: fakeD1(), STUDY_DEV_NO_AUTH: '1' }
    const response = await handleApi(new Request('https://study.test/api/me'), env as never)
    expect(await response.json()).toMatchObject({ role: 'admin', email: 'dev@localhost' })
  })
  it('refuses everyone until the administrator address is set', async () => {
    const env = { DB: fakeD1() }
    const response = await handleApi(
      new Request('https://study.test/api/me'),
      env as never,
      async () => ({
        status: 'ok' as const,
        email: 'pastor@church.org',
      }),
    )
    expect(response.status).toBe(503)
  })
  it('tells someone who has not been added, and someone who is paused', async () => {
    const { as } = make()
    const stranger = await as('guest@x.org')('/api/library')
    expect(stranger.status).toBe(403)
    expect(await stranger.json()).toMatchObject({ reason: 'not-added' })
    await as(admin)(
      '/api/people/guest%40x.org',
      json({ name: 'G', sections: ['library'], active: false }),
    )
    expect(await (await as('guest@x.org')('/api/library')).json()).toMatchObject({
      reason: 'paused',
    })
  })
  it('lets the pastor add a person and choose their parts; that person cannot manage people', async () => {
    const { as } = make()
    const put = await as(admin)(
      '/api/people/guest%40x.org',
      json({ name: 'Guest', sections: ['prayers', 'children'] }),
    )
    expect(put.status).toBe(200)
    expect((await (await as(admin)('/api/people')).json()).people).toEqual([
      { email: 'guest@x.org', name: 'Guest', sections: ['prayers', 'children'], active: true },
    ])
    const guest = as('guest@x.org')
    expect((await guest('/api/people')).status).toBe(403)
    expect((await guest('/api/people/other%40x.org', json({ sections: ['library'] }))).status).toBe(
      403,
    )
    expect(await (await guest('/api/me')).json()).toMatchObject({
      role: 'user',
      sections: ['prayers', 'children'],
    })
  })
  it('refuses a bad address, and the pastor’s own address', async () => {
    const { as } = make()
    expect((await as(admin)('/api/people/nope', json({ sections: [] }))).status).toBe(400)
    expect((await as(admin)(`/api/people/${admin}`, json({ sections: [] }))).status).toBe(400)
  })
  it('keeps libraries separate and enforces the parts on the server', async () => {
    const { as } = make()
    await as(admin)('/api/people/guest%40x.org', json({ name: 'Guest', sections: ['prayers'] }))
    const guest = as('guest@x.org'),
      pastor = as(admin)
    // The guest can save prayers, but not books, and never touches the sermon manuscripts.
    expect((await save(guest, [prayer])).status).toBe(200)
    expect((await save(guest, [book], 1)).status).toBe(403)
    expect((await guest('/api/sermon-text')).status).toBe(403)
    expect((await guest('/api/sermon-search?q=grace')).status).toBe(403)
    expect((await guest('/api/attachments/abcdefgh')).status).toBe(403)
    // The pastor's library has none of it, and the pastor's own save does not reach the guest.
    expect(await (await pastor('/api/library')).json()).toEqual({ revision: 0, records: [] })
    expect((await save(pastor, [book])).status).toBe(200)
    expect((await (await guest('/api/library')).json()).records).toEqual([prayer])
    // Turning a part off hides what was saved there and blocks further saves, without deleting it.
    await as(admin)('/api/people/guest%40x.org', json({ name: 'Guest', sections: ['library'] }))
    expect((await (await guest('/api/library')).json()).records).toEqual([])
    expect((await save(guest, [prayer], 1)).status).toBe(403)
    await as(admin)('/api/people/guest%40x.org', json({ name: 'Guest', sections: ['prayers'] }))
    expect((await (await guest('/api/library')).json()).records).toEqual([prayer])
  })
})
