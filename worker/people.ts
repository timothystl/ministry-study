// The people who can use the study, and which parts of it each may use. The pastor is named by the
// STUDY_ADMIN_EMAIL setting, not stored here, so the owner can never be locked out by editing this
// table. Everyone else is added by the pastor and must also be allowed through Cloudflare Access.
import { cleanSections, kindsFor, SECTION_KEYS, type SectionKey } from './sections'

export const ADMIN_OWNER = 'admin'
export interface Person {
  email: string
  name: string
  sections: SectionKey[]
  active: boolean
}
export interface Who {
  email: string
  name: string
  role: 'admin' | 'user'
  sections: SectionKey[]
  // Which record kinds this person may read and write; null means all of them (the admin).
  kinds: string[] | null
  // Whose rows in the shared database these are.
  owner: string
}
const EMAIL = /^[^\s@,;<>()"']{1,64}@[^\s@,;<>()"']{1,190}\.[^\s@,;<>()"']{2,20}$/
export const normalizeEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''
export const validEmail = (email: string) => email.length <= 254 && EMAIL.test(email)

const schema = [
  `CREATE TABLE IF NOT EXISTS people (
    email TEXT PRIMARY KEY, name TEXT NOT NULL, sections TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1, added_at TEXT NOT NULL)`,
]
const ready = new WeakSet<object>()
async function ensure(db: D1Database) {
  if (ready.has(db)) return
  await db.batch(schema.map((sql) => db.prepare(sql)))
  ready.add(db)
}
interface Row {
  email: string
  name: string
  sections: string
  active: number
}
const toPerson = (r: Row): Person => {
  let sections: SectionKey[] = []
  try {
    sections = cleanSections(JSON.parse(r.sections))
  } catch {
    // A damaged value gives no access rather than all of it.
  }
  return { email: r.email, name: r.name, sections, active: r.active === 1 }
}
export async function listPeople(db: D1Database): Promise<Person[]> {
  await ensure(db)
  const { results } = await db
    .prepare(`SELECT email, name, sections, active FROM people ORDER BY name COLLATE NOCASE, email`)
    .all<Row>()
  return results.map(toPerson)
}
export async function getPerson(db: D1Database, email: string): Promise<Person | null> {
  await ensure(db)
  const { results } = await db
    .prepare(`SELECT email, name, sections, active FROM people WHERE email = ?`)
    .bind(email)
    .all<Row>()
  return results[0] ? toPerson(results[0]) : null
}
export interface PersonInput {
  name: string
  sections: SectionKey[]
  active: boolean
}
export function validatePerson(input: unknown): PersonInput {
  const body = input as { name?: unknown; sections?: unknown; active?: unknown }
  if (!Array.isArray(body?.sections)) throw new Error('Choose which parts this person can use.')
  if (body.sections.some((s) => typeof s !== 'string' || !SECTION_KEYS.includes(s)))
    throw new Error('Unknown part of the app.')
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
  return { name, sections: cleanSections(body.sections), active: body.active !== false }
}
export async function savePerson(
  db: D1Database,
  email: string,
  input: PersonInput,
  now = new Date().toISOString(),
) {
  await ensure(db)
  await db
    .prepare(
      `INSERT INTO people (email, name, sections, active, added_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (email) DO UPDATE SET name = excluded.name, sections = excluded.sections,
         active = excluded.active`,
    )
    .bind(email, input.name || email, JSON.stringify(input.sections), input.active ? 1 : 0, now)
    .run()
}

export type Resolved = { ok: true; who: Who } | { ok: false; reason: 'not-added' | 'paused' }
// Works out who is asking. `adminEmail` is the pastor; `devAdmin` is the local no-sign-in mode.
export async function resolveWho(
  db: D1Database,
  email: string,
  adminEmail: string,
  devAdmin: boolean,
): Promise<Resolved> {
  const address = normalizeEmail(email)
  if (devAdmin || (adminEmail && address === normalizeEmail(adminEmail)))
    return {
      ok: true,
      who: {
        email: address,
        name: 'Andrew',
        role: 'admin',
        sections: SECTION_KEYS as SectionKey[],
        kinds: null,
        owner: ADMIN_OWNER,
      },
    }
  const person = await getPerson(db, address)
  if (!person) return { ok: false, reason: 'not-added' }
  if (!person.active) return { ok: false, reason: 'paused' }
  return {
    ok: true,
    who: {
      email: address,
      name: person.name,
      role: 'user',
      sections: person.sections,
      kinds: kindsFor(person.sections),
      owner: address,
    },
  }
}
