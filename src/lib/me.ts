import { SECTIONS, SECTION_KEYS, type SectionKey } from '../../worker/sections'

// Who is using the study, and which parts of it they may use. The server decides (and enforces it);
// this only shapes what the page shows.
export type { SectionKey }
export { SECTIONS }
export interface Me {
  email: string
  name: string
  role: 'admin' | 'user'
  sections: SectionKey[]
  // True when there is no shared server (running locally): everything is on and nothing is shared.
  local?: boolean
}
export type MeResult =
  { state: 'ok'; me: Me } | { state: 'blocked'; email: string; reason: 'not-added' | 'paused' }
const ME_KEY = 'ministry-study.me.v1'
export const localMe: Me = {
  email: '',
  name: 'Andrew',
  role: 'admin',
  sections: SECTION_KEYS as SectionKey[],
  local: true,
}
function cached(): Me | null {
  try {
    const value = JSON.parse(localStorage.getItem(ME_KEY) || 'null')
    return value && typeof value.email === 'string' && Array.isArray(value.sections) ? value : null
  } catch {
    return null
  }
}
function remember(me: Me | null) {
  try {
    if (me) localStorage.setItem(ME_KEY, JSON.stringify(me))
    else localStorage.removeItem(ME_KEY)
  } catch {
    // Only used when the connection is down; the next start simply asks the server again.
  }
}
export async function fetchMe(): Promise<MeResult> {
  try {
    const response = await fetch('/api/me', { headers: { Accept: 'application/json' } })
    const json = (response.headers.get('Content-Type') || '').includes('json')
    if (json && response.status === 403) {
      const body = (await response.json()) as { reason?: string; email?: string }
      remember(null)
      return {
        state: 'blocked',
        email: body.email || '',
        reason: body.reason === 'paused' ? 'paused' : 'not-added',
      }
    }
    if (json && response.ok) {
      const me = (await response.json()) as Me
      const clean = {
        ...me,
        sections: SECTION_KEYS.filter((k) => me.sections.includes(k as SectionKey)) as SectionKey[],
      }
      remember(clean)
      return { state: 'ok', me: clean }
    }
  } catch {
    // Offline: fall through to what this device last knew.
  }
  // No shared server (local use, or sign-in not set up), or it cannot be reached right now.
  return { state: 'ok', me: cached() ?? localMe }
}
export const can = (me: Me, section: SectionKey) =>
  me.role === 'admin' || me.sections.includes(section)
