import { DatabaseSync } from 'node:sqlite'

// A minimal D1 stand-in backed by real SQLite, so the actual SQL is exercised.
export function fakeD1() {
  const sqlite = new DatabaseSync(':memory:')
  const statement = (sql: string, params: unknown[] = []) => ({
    sql,
    params,
    bind: (...values: unknown[]) => statement(sql, values),
    run: () => run(sql, params),
    all: () => all(sql, params),
  })
  const all = (sql: string, params: unknown[]) => ({
    results: sqlite.prepare(sql).all(...(params as never[])),
    meta: { changes: 0 },
  })
  const run = (sql: string, params: unknown[]) => {
    if (/^\s*select/i.test(sql)) return all(sql, params)
    const r = sqlite.prepare(sql).run(...(params as never[]))
    return { results: [], meta: { changes: Number(r.changes) } }
  }
  return {
    prepare: (sql: string) => statement(sql),
    batch: async (list: { sql: string; params: unknown[] }[]) => {
      sqlite.exec('BEGIN')
      try {
        const out = list.map((s) => run(s.sql, s.params))
        sqlite.exec('COMMIT')
        return out
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
  } as unknown as D1Database
}
