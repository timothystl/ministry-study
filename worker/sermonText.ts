// Full sermon manuscripts, kept apart from the library so the library stays quick to load.
// `sermon_text` holds the text (the backup copy); `sermon_fts` is the search index over the same
// text, and a sermon can be left out of the index while its text is still kept. Every row belongs
// to one owner (a person's own library; the pastor's is 'admin'), and every query filters on it.
import { hasColumn } from './store'
export const MAX_TEXT = 600_000
const ID = /^[A-Za-z0-9_-]{1,80}$/
export const validSermonId = (id: string) => ID.test(id)

const textTable = (name: string) =>
  `CREATE TABLE IF NOT EXISTS ${name} (
    owner TEXT NOT NULL, sermon_id TEXT NOT NULL, body TEXT NOT NULL, chars INTEGER NOT NULL,
    hash TEXT NOT NULL, file_name TEXT NOT NULL, indexed INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL, PRIMARY KEY (owner, sermon_id))`
const ftsTable = `CREATE VIRTUAL TABLE IF NOT EXISTS sermon_fts USING fts5(
    body, sermon_id UNINDEXED, owner UNINDEXED, tokenize = 'porter unicode61')`
const schema = [textTable('sermon_text'), ftsTable]
// Manuscripts saved before people were added belong to the pastor. The search index cannot be
// altered, so it is rebuilt from the saved text.
const upgrade = [
  textTable('sermon_text_v2'),
  `INSERT OR IGNORE INTO sermon_text_v2 (owner, sermon_id, body, chars, hash, file_name, indexed, updated_at)
     SELECT 'admin', sermon_id, body, chars, hash, file_name, indexed, updated_at FROM sermon_text`,
  `DROP TABLE sermon_text`,
  `ALTER TABLE sermon_text_v2 RENAME TO sermon_text`,
  `DROP TABLE IF EXISTS sermon_fts`,
  ftsTable,
  `INSERT INTO sermon_fts (body, sermon_id, owner)
     SELECT body, sermon_id, owner FROM sermon_text WHERE indexed = 1`,
]
const ready = new WeakSet<object>()
async function ensure(db: D1Database) {
  if (ready.has(db)) return
  await db.batch(schema.map((sql) => db.prepare(sql)))
  if (!(await hasColumn(db, 'sermon_text', 'owner'))) {
    try {
      await db.batch(upgrade.map((sql) => db.prepare(sql)))
    } catch (error) {
      if (!(await hasColumn(db, 'sermon_text', 'owner'))) throw error
    }
  }
  ready.add(db)
}
export interface TextInput {
  text: string
  hash: string
  fileName: string
  indexed: boolean
}
export function validateText(input: unknown): TextInput {
  const body = input as Partial<TextInput>
  if (typeof body?.text !== 'string' || !body.text.trim())
    throw new Error('There is no text to save.')
  if (body.text.length > MAX_TEXT) throw new Error('That manuscript is too long to store.')
  if (typeof body.hash !== 'string' || !/^[a-f0-9]{8,64}$/.test(body.hash))
    throw new Error('A content hash is required.')
  return {
    text: body.text,
    hash: body.hash,
    fileName: typeof body.fileName === 'string' ? body.fileName.slice(0, 300) : '',
    indexed: body.indexed !== false,
  }
}
export async function putText(
  db: D1Database,
  owner: string,
  id: string,
  input: TextInput,
  now = new Date().toISOString(),
) {
  await ensure(db)
  const statements = [
    db
      .prepare(
        `INSERT INTO sermon_text (owner, sermon_id, body, chars, hash, file_name, indexed, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (owner, sermon_id) DO UPDATE SET body = excluded.body, chars = excluded.chars,
           hash = excluded.hash, file_name = excluded.file_name, indexed = excluded.indexed,
           updated_at = excluded.updated_at`,
      )
      .bind(
        owner,
        id,
        input.text,
        input.text.length,
        input.hash,
        input.fileName,
        input.indexed ? 1 : 0,
        now,
      ),
    db.prepare(`DELETE FROM sermon_fts WHERE owner = ? AND sermon_id = ?`).bind(owner, id),
  ]
  if (input.indexed)
    statements.push(
      db
        .prepare(`INSERT INTO sermon_fts (body, sermon_id, owner) VALUES (?, ?, ?)`)
        .bind(input.text, id, owner),
    )
  await db.batch(statements)
}
export async function getText(db: D1Database, owner: string, id: string) {
  await ensure(db)
  const { results } = await db
    .prepare(
      `SELECT body, chars, hash, file_name, indexed, updated_at FROM sermon_text WHERE owner = ? AND sermon_id = ?`,
    )
    .bind(owner, id)
    .all<{
      body: string
      chars: number
      hash: string
      file_name: string
      indexed: number
      updated_at: string
    }>()
  const row = results[0]
  return (
    row && {
      text: row.body,
      chars: row.chars,
      hash: row.hash,
      fileName: row.file_name,
      indexed: row.indexed === 1,
      updatedAt: row.updated_at,
    }
  )
}
export async function deleteText(db: D1Database, owner: string, id: string) {
  await ensure(db)
  await db.batch([
    db.prepare(`DELETE FROM sermon_text WHERE owner = ? AND sermon_id = ?`).bind(owner, id),
    db.prepare(`DELETE FROM sermon_fts WHERE owner = ? AND sermon_id = ?`).bind(owner, id),
  ])
}
// Turn the index on or off for a sermon without touching its text.
export async function setIndexed(db: D1Database, owner: string, id: string, indexed: boolean) {
  const row = await getText(db, owner, id)
  if (!row) return false
  await putText(
    db,
    owner,
    id,
    { text: row.text, hash: row.hash, fileName: row.fileName, indexed },
    row.updatedAt,
  )
  return true
}
export async function listStatus(db: D1Database, owner: string) {
  await ensure(db)
  const { results } = await db
    .prepare(
      `SELECT sermon_id, chars, hash, indexed FROM sermon_text WHERE owner = ? ORDER BY sermon_id`,
    )
    .bind(owner)
    .all<{ sermon_id: string; chars: number; hash: string; indexed: number }>()
  return results.map((r) => ({
    id: r.sermon_id,
    chars: r.chars,
    hash: r.hash,
    indexed: r.indexed === 1,
  }))
}
// Words are searched together (all must appear); "quoted words" are a phrase. Anything else is
// treated as plain text, so a stray symbol cannot break the search.
export function ftsQuery(input: string): string {
  const parts = [...input.matchAll(/"([^"]+)"|(\S+)/g)]
    .map((m) =>
      (m[1] ?? m[2])
        .replace(/[^\p{L}\p{N}' ]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
  return parts.map((p) => `"${p.replace(/"/g, '')}"`).join(' AND ')
}
export interface TextHit {
  id: string
  snippet: string
}
export async function searchText(
  db: D1Database,
  owner: string,
  query: string,
  limit = 60,
): Promise<TextHit[]> {
  await ensure(db)
  const match = ftsQuery(query)
  if (!match) return []
  const { results } = await db
    .prepare(
      `SELECT sermon_id, snippet(sermon_fts, 0, '[[', ']]', '…', 28) AS snippet
       FROM sermon_fts WHERE sermon_fts MATCH ? AND owner = ? ORDER BY rank LIMIT ?`,
    )
    .bind(match, owner, limit)
    .all<{ sermon_id: string; snippet: string }>()
  return results.map((r) => ({ id: r.sermon_id, snippet: r.snippet }))
}
// Every manuscript, for a backup download.
export async function exportAll(db: D1Database, owner: string, after = '', limit = 40) {
  await ensure(db)
  const { results } = await db
    .prepare(
      `SELECT sermon_id, body, file_name FROM sermon_text
       WHERE owner = ? AND sermon_id > ? ORDER BY sermon_id LIMIT ?`,
    )
    .bind(owner, after, limit)
    .all<{ sermon_id: string; body: string; file_name: string }>()
  return results.map((r) => ({ id: r.sermon_id, text: r.body, fileName: r.file_name }))
}
