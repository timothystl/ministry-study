// How much of the shared library's space each kind of thing uses, for one person's own library.
// Files are listed by name and size so the biggest can be found and cut back; text is counted in
// characters. Nothing here reads a file's contents.
export const MAX_LISTED = 5000
export interface Usage {
  files: { id: string; name: string; mime: string; size: number }[]
  filesTruncated: boolean
  records: { count: number; bytes: number }
  manuscripts: { count: number; bytes: number }
}
const none = { count: 0, bytes: 0 }
// A part of the database that has never been used may not have its table yet: that is zero, not an error.
async function tally(db: D1Database, sql: string, owner: string) {
  try {
    const { results } = await db.prepare(sql).bind(owner).all<{ n: number; b: number | null }>()
    return { count: results[0]?.n ?? 0, bytes: results[0]?.b ?? 0 }
  } catch {
    return none
  }
}
export async function usageFor(db: D1Database, owner: string): Promise<Usage> {
  let files: Usage['files'] = []
  try {
    const { results } = await db
      .prepare(
        `SELECT id, name, mime, size FROM attachment WHERE owner = ? ORDER BY size DESC LIMIT ?`,
      )
      .bind(owner, MAX_LISTED + 1)
      .all<Usage['files'][number]>()
    files = results
  } catch {
    files = []
  }
  return {
    files: files.slice(0, MAX_LISTED),
    filesTruncated: files.length > MAX_LISTED,
    records: await tally(
      db,
      `SELECT COUNT(*) AS n, SUM(LENGTH(data)) AS b FROM records WHERE owner = ?`,
      owner,
    ),
    manuscripts: await tally(
      db,
      `SELECT COUNT(*) AS n, SUM(chars) AS b FROM sermon_text WHERE owner = ?`,
      owner,
    ),
  }
}
