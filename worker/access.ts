// Verifies the sign-in token Cloudflare Access attaches to every request, the same way the
// other Timothy apps do. Without a configured team and application, every call is refused.
export interface AccessEnv {
  STUDY_ACCESS_TEAM_DOMAIN?: string
  STUDY_ACCESS_AUD?: string
  STUDY_DEV_NO_AUTH?: string
}
export type AccessResult =
  { status: 'ok'; email: string } | { status: 'unauthorized' } | { status: 'unconfigured' }
type KeyFetcher = (team: string) => Promise<JsonWebKey[]>
let cache: { team: string; keys: JsonWebKey[]; at: number } | null = null

async function fetchKeys(team: string): Promise<JsonWebKey[]> {
  if (cache && cache.team === team && Date.now() - cache.at < 3_600_000) return cache.keys
  const response = await fetch(`https://${team}/cdn-cgi/access/certs`)
  if (!response.ok) throw new Error('Could not load sign-in keys.')
  const keys = ((await response.json()) as { keys: JsonWebKey[] }).keys
  cache = { team, keys, at: Date.now() }
  return keys
}
const decode = (part: string) =>
  Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const json = (part: string) => JSON.parse(new TextDecoder().decode(decode(part)))

export async function verifyAccess(
  request: Request,
  env: AccessEnv,
  keys: KeyFetcher = fetchKeys,
  now = Date.now(),
): Promise<AccessResult> {
  if (env.STUDY_DEV_NO_AUTH === '1') return { status: 'ok', email: 'dev@localhost' }
  const team = env.STUDY_ACCESS_TEAM_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const aud = env.STUDY_ACCESS_AUD
  if (!team || !aud) return { status: 'unconfigured' }
  const token = request.headers.get('Cf-Access-Jwt-Assertion')
  const parts = token?.split('.')
  if (!parts || parts.length !== 3) return { status: 'unauthorized' }
  try {
    const header = json(parts[0]),
      claims = json(parts[1])
    if (header.alg !== 'RS256') return { status: 'unauthorized' }
    const jwk = (await keys(team)).find((k) => (k as { kid?: string }).kid === header.kid)
    if (!jwk) return { status: 'unauthorized' }
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decode(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    )
    const audiences: string[] = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
    if (
      !valid ||
      !audiences.includes(aud) ||
      claims.iss !== `https://${team}` ||
      typeof claims.exp !== 'number' ||
      claims.exp * 1000 < now ||
      (typeof claims.nbf === 'number' && claims.nbf * 1000 > now + 60_000) ||
      typeof claims.email !== 'string'
    )
      return { status: 'unauthorized' }
    return { status: 'ok', email: claims.email }
  } catch {
    return { status: 'unauthorized' }
  }
}
