import { afterEach, describe, expect, it, vi } from 'vitest'
import { can, fetchMe, localMe } from './me'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})
const reply = (status: number, body: unknown, type = 'application/json') =>
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': type } }),
    ),
  )
afterEach(() => store.clear())

describe('who is signed in', () => {
  const guest = { email: 'g@x.org', name: 'G', role: 'user', sections: ['prayers', 'bogus'] }
  it('keeps only known parts, and remembers them for when the connection drops', async () => {
    reply(200, guest)
    const found = await fetchMe()
    expect(found).toMatchObject({ state: 'ok', me: { sections: ['prayers'] } })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    )
    expect(await fetchMe()).toMatchObject({ state: 'ok', me: { email: 'g@x.org', role: 'user' } })
  })
  it('reports a person who is not added or is paused, and forgets what it knew', async () => {
    reply(200, guest)
    await fetchMe()
    reply(403, { reason: 'paused', email: 'g@x.org' })
    expect(await fetchMe()).toEqual({ state: 'blocked', email: 'g@x.org', reason: 'paused' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    )
    expect(await fetchMe()).toEqual({ state: 'ok', me: localMe })
  })
  it('works locally with everything on when there is no shared server', async () => {
    reply(200, '<html></html>', 'text/html')
    const found = await fetchMe()
    expect(found).toEqual({ state: 'ok', me: localMe })
    expect(can(localMe, 'sermons')).toBe(true)
  })
  it('lets only switched-on parts through for a person, everything for the pastor', () => {
    expect(can({ ...guest, sections: ['prayers'] } as never, 'prayers')).toBe(true)
    expect(can({ ...guest, sections: ['prayers'] } as never, 'sermons')).toBe(false)
    expect(can({ ...guest, role: 'admin', sections: [] } as never, 'sermons')).toBe(true)
  })
})
