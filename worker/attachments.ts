import { hasColumn } from './store'
// Photos and PDFs kept with a record (a hymn's sheet music, a scanned hymnal page). The bytes are
// stored in the shared database in pieces, so nothing more is needed than what is already set up.
// Each file belongs to one person (the pastor's is 'admin'); nobody can read, replace or delete
// another person's file, even by guessing its id.
export const MAX_ATTACHMENT = 8_000_000
const PIECE = 600_000 // characters of base64 per row
const ID = /^[A-Za-z0-9_-]{8,80}$/
export const validAttachmentId = (id: string) => ID.test(id)
export const ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const

const schema = [
  `CREATE TABLE IF NOT EXISTS attachment (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL,
    pieces INTEGER NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS attachment_piece (
    id TEXT NOT NULL, seq INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (id, seq))`,
]
const ready = new WeakSet<object>()
async function ensure(db: D1Database) {
  if (ready.has(db)) return
  await db.batch(schema.map((sql) => db.prepare(sql)))
  // Files saved before people were added belong to the pastor.
  if (!(await hasColumn(db, 'attachment', 'owner'))) {
    try {
      await db
        .prepare(`ALTER TABLE attachment ADD COLUMN owner TEXT NOT NULL DEFAULT 'admin'`)
        .run()
    } catch (error) {
      if (!(await hasColumn(db, 'attachment', 'owner'))) throw error
    }
  }
  ready.add(db)
}
const ownedBy = async (db: D1Database, owner: string, id: string) => {
  const { results } = await db
    .prepare(`SELECT owner FROM attachment WHERE id = ?`)
    .bind(id)
    .all<{ owner: string }>()
  return results.length === 0 ? null : results[0].owner === owner
}
type Native = { toBase64?: () => string }
export function toBase64(bytes: Uint8Array): string {
  // Newer runtimes encode natively, which keeps the work small.
  const native = (bytes as unknown as Native).toBase64
  if (native) return native.call(bytes)
  let out = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(out)
}
export function fromBase64(text: string): Uint8Array {
  const fast = (Uint8Array as unknown as { fromBase64?: (t: string) => Uint8Array }).fromBase64
  if (fast) return fast(text)
  const raw = atob(text)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
// The bytes must really be what the type says, so a mislabeled file is not served as something else.
export function sniff(bytes: Uint8Array): string {
  const at = (...b: number[]) => b.every((v, i) => bytes[i] === v)
  if (at(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (at(0x89, 0x50, 0x4e, 0x47)) return 'image/png'
  if (at(0x47, 0x49, 0x46, 0x38)) return 'image/gif'
  if (at(0x25, 0x50, 0x44, 0x46)) return 'application/pdf'
  if (at(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp'
  return ''
}
// Music and slide files are kept as downloads, judged by their ending. Those built on the zip
// format must really start like one, and an mp3 must start like an mp3.
export const DOWNLOAD_TYPE = 'application/octet-stream'
const ZIPPED = new Set(['pptx', 'docx', 'musx', 'mscz', 'key'])
const PLAIN = new Set([
  'mus',
  'etf',
  'mxl',
  'sib',
  'ppt',
  'doc',
  'mid',
  'midi',
  'wav',
  'm4a',
  'txt',
  'md',
  'rtf',
])
const extension = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() || ''
export const isDownloadName = (name: string) => {
  const ext = extension(name)
  return ZIPPED.has(ext) || PLAIN.has(ext) || ext === 'mp3'
}
function looksRight(bytes: Uint8Array, ext: string) {
  if (ZIPPED.has(ext)) return bytes[0] === 0x50 && bytes[1] === 0x4b
  if (ext === 'mp3')
    return (
      (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    )
  return true
}
export function checkUpload(bytes: Uint8Array, claimed: string, name = '') {
  if (!bytes.length) throw new Error('The file is empty.')
  if (bytes.length > MAX_ATTACHMENT) throw new Error('That file is too large (8 MB at most).')
  const type = claimed.split(';')[0].trim().toLowerCase()
  const real = sniff(bytes)
  if (real && (ATTACHMENT_TYPES as readonly string[]).includes(real)) {
    if (type && type !== real) throw new Error('That file is not the kind it says it is.')
    return real
  }
  const ext = extension(name)
  if (isDownloadName(name) && (!type || type === DOWNLOAD_TYPE)) {
    if (!looksRight(bytes, ext)) throw new Error('That file is not the kind its name says it is.')
    return DOWNLOAD_TYPE
  }
  throw new Error('Only photos, PDFs, music, slide and Finale files can be attached.')
}
// Returns false, and changes nothing, if the id already belongs to someone else.
export async function putAttachment(
  db: D1Database,
  owner: string,
  id: string,
  name: string,
  mime: string,
  bytes: Uint8Array,
  now = new Date().toISOString(),
) {
  await ensure(db)
  if ((await ownedBy(db, owner, id)) === false) return false
  const text = toBase64(bytes)
  const statements = [
    db.prepare(`DELETE FROM attachment_piece WHERE id = ?`).bind(id),
    db.prepare(`DELETE FROM attachment WHERE id = ?`).bind(id),
  ]
  const pieces = Math.ceil(text.length / PIECE)
  for (let i = 0; i < pieces; i++)
    statements.push(
      db
        .prepare(`INSERT INTO attachment_piece (id, seq, data) VALUES (?, ?, ?)`)
        .bind(id, i, text.slice(i * PIECE, (i + 1) * PIECE)),
    )
  statements.push(
    db
      .prepare(
        `INSERT INTO attachment (id, name, mime, size, pieces, created_at, owner) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, name.slice(0, 200), mime, bytes.length, pieces, now, owner),
  )
  await db.batch(statements)
  return true
}
export async function getAttachment(db: D1Database, owner: string, id: string) {
  await ensure(db)
  const { results } = await db
    .prepare(`SELECT name, mime, size, pieces FROM attachment WHERE id = ? AND owner = ?`)
    .bind(id, owner)
    .all<{ name: string; mime: string; size: number; pieces: number }>()
  const meta = results[0]
  if (!meta) return null
  const { results: rows } = await db
    .prepare(`SELECT data FROM attachment_piece WHERE id = ? ORDER BY seq`)
    .bind(id)
    .all<{ data: string }>()
  if (rows.length !== meta.pieces) return null
  return { ...meta, bytes: fromBase64(rows.map((r) => r.data).join('')) }
}
export async function deleteAttachment(db: D1Database, owner: string, id: string) {
  await ensure(db)
  if ((await ownedBy(db, owner, id)) !== true) return
  await db.batch([
    db.prepare(`DELETE FROM attachment_piece WHERE id = ?`).bind(id),
    db.prepare(`DELETE FROM attachment WHERE id = ?`).bind(id),
  ])
}
