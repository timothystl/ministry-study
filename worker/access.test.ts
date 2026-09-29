import { describe, expect, it } from 'vitest'
import { verifyAccess } from './access'

const b64 = (bytes: ArrayBuffer | string) => {
  const raw = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : new Uint8Array(bytes)
  return btoa(String.fromCharCode(...raw))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
async function token(claims: object, kid = 'k1') {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  const head = b64(JSON.stringify({ alg: 'RS256', kid })),
    body = b64(JSON.stringify(claims))
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    pair.privateKey,
    new TextEncoder().encode(`${head}.${body}`),
  )
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid }
  return { jwt: `${head}.${body}.${b64(sig)}`, jwk }
}
const env = { STUDY_ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com', STUDY_ACCESS_AUD: 'aud1' }
const good = {
  aud: ['aud1'],
  iss: 'https://team.cloudflareaccess.com',
  exp: 2_000_000_000,
  email: 'a@timothystl.org',
}
const ask = (jwt: string) =>
  new Request('https://x.test/api/library', { headers: { 'Cf-Access-Jwt-Assertion': jwt } })

describe('Cloudflare Access verification', () => {
  it('accepts a correctly signed token for this application', async () => {
    const { jwt, jwk } = await token(good)
    expect(await verifyAccess(ask(jwt), env, async () => [jwk], 1_900_000_000_000)).toEqual({
      status: 'ok',
      email: 'a@timothystl.org',
    })
  })
  it('rejects wrong application, expired, wrong issuer, and wrong signing key', async () => {
    const now = 1_900_000_000_000
    const a = await token({ ...good, aud: ['other'] })
    expect((await verifyAccess(ask(a.jwt), env, async () => [a.jwk], now)).status).toBe(
      'unauthorized',
    )
    const b = await token({ ...good, exp: 1_000_000_000 })
    expect((await verifyAccess(ask(b.jwt), env, async () => [b.jwk], now)).status).toBe(
      'unauthorized',
    )
    const c = await token({ ...good, iss: 'https://evil.example' })
    expect((await verifyAccess(ask(c.jwt), env, async () => [c.jwk], now)).status).toBe(
      'unauthorized',
    )
    const d = await token(good),
      e = await token(good)
    expect((await verifyAccess(ask(d.jwt), env, async () => [e.jwk], now)).status).toBe(
      'unauthorized',
    )
  })
})
