// Shared-library storage on Cloudflare D1. Every catalog item (book, series, loan, and later
// sermons, messages, hymns) is one row keyed by kind + id, so a save writes only what changed.
// `meta.revision` counts accepted saves; a save made from an older revision is refused instead of
// overwriting work done on another device.
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

const schema = [
  `CREATE TABLE IF NOT EXISTS records (
    kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY (kind, id))`,
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL)`,
  `INSERT OR IGNORE INTO meta (key, value) VALUES ('revision', 0)`,
]
const ready = new WeakSet<object>()
export async function ensureSchema(db: D1Database) {
  if (ready.has(db)) return
  await db.batch(schema.map((sql) => db.prepare(sql)))
  ready.add(db)
}

export async function readAll(db: D1Database) {
  await ensureSchema(db)
  const [rev, rows] = await db.batch<{ value?: number } & StoredRecord>([
    db.prepare(`SELECT value FROM meta WHERE key = 'revision'`),
    db.prepare(`SELECT kind, id, data FROM records ORDER BY kind, id`),
  ])
  return {
    revision: Number(rev.results[0]?.value ?? 0),
    records: rows.results as StoredRecord[],
  }
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
  baseRevision: number,
  change: Change,
  now = new Date().toISOString(),
): Promise<{ ok: boolean; revision: number }> {
  await ensureSchema(db)
  const guard = `(SELECT value FROM meta WHERE key = 'revision') = ?`
  const statements = [
    ...change.upserts.map((r) =>
      db
        .prepare(
          `INSERT INTO records (kind, id, data, updated_at)
           SELECT ?, ?, ?, ? WHERE ${guard}
           ON CONFLICT (kind, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        )
        .bind(r.kind, r.id, r.data, now, baseRevision),
    ),
    ...change.deletes.map((r) =>
      db
        .prepare(`DELETE FROM records WHERE kind = ? AND id = ? AND ${guard}`)
        .bind(r.kind, r.id, baseRevision),
    ),
    db
      .prepare(`UPDATE meta SET value = value + 1 WHERE key = 'revision' AND value = ?`)
      .bind(baseRevision),
  ]
  const results = await db.batch(statements)
  if (results[results.length - 1].meta.changes === 1)
    return { ok: true, revision: baseRevision + 1 }
  const { revision } = await readAll(db)
  return { ok: false, revision }
}
