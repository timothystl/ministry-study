// Shared-library storage on Cloudflare D1. Every catalog item (book, series, loan, and later
// sermons, messages, hymns) is one row keyed by owner + kind + id, so a save writes only what
// changed, and each person's library is a separate set of rows. The pastor's rows have the owner
// 'admin' (this is also what every row saved before people were added became).
// The revision counts accepted saves for one owner; a save made from an older revision is refused
// instead of overwriting work done on another device. The pastor's counter is the original
// `revision` key, so nothing had to move when people were added.
export interface StoredRecord {
  kind: string
  id: string
  data: string
}
export interface Change {
  upserts: StoredRecord[]
  deletes: { kind: string; id: string }[]
}
export const MAX_OPERATIONS = 400
const KIND = /^[a-z][a-z0-9-]{0,30}$/
const MAX_ID = 200
const MAX_DATA = 500_000

const recordsTable = (name: string) =>
  `CREATE TABLE IF NOT EXISTS ${name} (
    owner TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
    updated_at TEXT NOT NULL, PRIMARY KEY (owner, kind, id))`
const schema = [
  recordsTable('records'),
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL)`,
  `INSERT OR IGNORE INTO meta (key, value) VALUES ('revision', 0)`,
]
// A database from before people were added has a records table without an owner: move every row
// to the pastor in one step. Safe to run again, and safe if two requests arrive at once.
const upgrade = [
  recordsTable('records_v2'),
  `INSERT OR IGNORE INTO records_v2 (owner, kind, id, data, updated_at)
     SELECT 'admin', kind, id, data, updated_at FROM records`,
  `DROP TABLE records`,
  `ALTER TABLE records_v2 RENAME TO records`,
]
export const hasColumn = async (db: D1Database, table: string, column: string) => {
  const { results } = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>()
  return results.some((c) => c.name === column)
}
const ready = new WeakSet<object>()
export async function ensureSchema(db: D1Database) {
  if (ready.has(db)) return
  await db.batch(schema.map((sql) => db.prepare(sql)))
  if (!(await hasColumn(db, 'records', 'owner'))) {
    try {
      await db.batch(upgrade.map((sql) => db.prepare(sql)))
    } catch (error) {
      if (!(await hasColumn(db, 'records', 'owner'))) throw error
    }
  }
  ready.add(db)
}
export const revisionKey = (owner: string) => (owner === 'admin' ? 'revision' : `revision:${owner}`)

// `kinds` limits what is returned to the parts of the app a person may use; null means everything.
export async function readAll(db: D1Database, owner = 'admin', kinds: string[] | null = null) {
  await ensureSchema(db)
  const [rev, rows] = await db.batch<{ value?: number } & StoredRecord>([
    db.prepare(`SELECT value FROM meta WHERE key = ?`).bind(revisionKey(owner)),
    db.prepare(`SELECT kind, id, data FROM records WHERE owner = ? ORDER BY kind, id`).bind(owner),
  ])
  return {
    revision: Number(rev.results[0]?.value ?? 0),
    records: (rows.results as StoredRecord[]).filter((r) => !kinds || kinds.includes(r.kind)),
  }
}
// Names any record kind in a change that this person is not allowed to touch.
export function forbiddenKinds(change: Change, kinds: string[] | null): string[] {
  if (!kinds) return []
  return [...new Set([...change.upserts, ...change.deletes].map((r) => r.kind))].filter(
    (k) => !kinds.includes(k),
  )
}

export function validateChange(input: unknown): Change {
  const body = input as { upserts?: unknown; deletes?: unknown }
  const upserts = body?.upserts ?? [],
    deletes = body?.deletes ?? []
  if (!Array.isArray(upserts) || !Array.isArray(deletes)) throw new Error('Invalid change list.')
  if (upserts.length + deletes.length > MAX_OPERATIONS)
    throw new Error(`Send at most ${MAX_OPERATIONS} changes at a time.`)
  const check = (r: { kind?: unknown; id?: unknown }) => {
    if (typeof r?.kind !== 'string' || !KIND.test(r.kind)) throw new Error('Invalid record kind.')
    if (typeof r.id !== 'string' || !r.id || r.id.length > MAX_ID)
      throw new Error('Invalid record id.')
  }
  for (const r of upserts as StoredRecord[]) {
    check(r)
    if (typeof r.data !== 'string' || r.data.length > MAX_DATA)
      throw new Error('Invalid record data.')
    JSON.parse(r.data)
  }
  for (const r of deletes as { kind: string; id: string }[]) check(r)
  return { upserts: upserts as StoredRecord[], deletes: deletes as { kind: string; id: string }[] }
}

// All writes are guarded by the revision the caller last saw, and run as one transaction.
export async function applyChanges(
  db: D1Database,
  owner: string,
  baseRevision: number,
  change: Change,
  now = new Date().toISOString(),
): Promise<{ ok: boolean; revision: number }> {
  await ensureSchema(db)
  const key = revisionKey(owner)
  // A person's first save creates their counter at 0, so the guard below works the same for everyone.
  const guard = `(SELECT value FROM meta WHERE key = ?) = ?`
  const statements = [
    db.prepare(`INSERT OR IGNORE INTO meta (key, value) VALUES (?, 0)`).bind(key),
    ...change.upserts.map((r) =>
      db
        .prepare(
          `INSERT INTO records (owner, kind, id, data, updated_at)
           SELECT ?, ?, ?, ?, ? WHERE ${guard}
           ON CONFLICT (owner, kind, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        )
        .bind(owner, r.kind, r.id, r.data, now, key, baseRevision),
    ),
    ...change.deletes.map((r) =>
      db
        .prepare(`DELETE FROM records WHERE owner = ? AND kind = ? AND id = ? AND ${guard}`)
        .bind(owner, r.kind, r.id, key, baseRevision),
    ),
    db
      .prepare(`UPDATE meta SET value = value + 1 WHERE key = ? AND value = ?`)
      .bind(key, baseRevision),
  ]
  const results = await db.batch(statements)
  if (results[results.length - 1].meta.changes === 1)
    return { ok: true, revision: baseRevision + 1 }
  const { revision } = await readAll(db, owner)
  return { ok: false, revision }
}
