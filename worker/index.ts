import { verifyAccess, type AccessEnv } from './access'
import { applyChanges, readAll, validateChange } from './store'
import {
  deleteText,
  exportAll,
  getText,
  listStatus,
  putText,
  searchText,
  setIndexed,
  validateText,
  validSermonId,
} from './sermonText'

interface Env extends AccessEnv {
  DB: D1Database
  ASSETS: Fetcher
}
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url)
  const access = await verifyAccess(request, env)
  if (access.status === 'unconfigured')
    return reply({ error: 'Sign-in protection is not set up for the shared library.' }, 503)
  if (access.status !== 'ok') return reply({ error: 'Please sign in.' }, 401)
  if (!env.DB) return reply({ error: 'The shared database is not connected.' }, 503)
  try {
    if (pathname === '/api/library' && request.method === 'GET') return reply(await readAll(env.DB))
    if (pathname === '/api/changes' && request.method === 'POST') {
      if (!request.headers.get('Content-Type')?.includes('application/json'))
        return reply({ error: 'Send JSON.' }, 415)
      const body = (await request.json()) as { baseRevision?: unknown }
      if (!Number.isInteger(body.baseRevision) || (body.baseRevision as number) < 0)
        return reply({ error: 'A base revision is required.' }, 400)
      let change
      try {
        change = validateChange(body)
      } catch (error) {
        return reply({ error: (error as Error).message }, 400)
      }
      const result = await applyChanges(env.DB, body.baseRevision as number, change)
      return result.ok ? reply(result) : reply({ error: 'changed-elsewhere', ...result }, 409)
    }
    if (pathname === '/api/sermon-text' && request.method === 'GET')
      return reply(await listStatus(env.DB))
    if (pathname === '/api/sermon-search' && request.method === 'GET') {
      const q = new URL(request.url).searchParams.get('q') || ''
      return reply(q.length > 200 ? [] : await searchText(env.DB, q))
    }
    if (pathname === '/api/sermon-export' && request.method === 'GET') {
      const after = new URL(request.url).searchParams.get('after') || ''
      return reply(await exportAll(env.DB, after))
    }
    const textRoute = /^\/api\/sermon-text\/([^/]+)$/.exec(pathname)
    if (textRoute) {
      const id = decodeURIComponent(textRoute[1])
      if (!validSermonId(id)) return reply({ error: 'Invalid sermon.' }, 400)
      if (request.method === 'GET') {
        const found = await getText(env.DB, id)
        return found ? reply(found) : reply({ error: 'No text saved.' }, 404)
      }
      if (request.method === 'DELETE') {
        await deleteText(env.DB, id)
        return reply({ ok: true })
      }
      if (request.method === 'PUT' || request.method === 'PATCH') {
        if (!request.headers.get('Content-Type')?.includes('application/json'))
          return reply({ error: 'Send JSON.' }, 415)
        const body = (await request.json()) as { indexed?: unknown }
        if (request.method === 'PATCH') {
          if (typeof body.indexed !== 'boolean')
            return reply({ error: 'Say whether to index.' }, 400)
          return (await setIndexed(env.DB, id, body.indexed))
            ? reply({ ok: true })
            : reply({ error: 'No text saved.' }, 404)
        }
        let input
        try {
          input = validateText(body)
        } catch (error) {
          return reply({ error: (error as Error).message }, 400)
        }
        await putText(env.DB, id, input)
        return reply({ ok: true, chars: input.text.length })
      }
    }
    return reply({ error: 'Not found.' }, 404)
  } catch {
    return reply({ error: 'The shared library could not be reached. Nothing was lost.' }, 500)
  }
}

export default {
  fetch(request: Request, env: Env) {
    return new URL(request.url).pathname.startsWith('/api/')
      ? handleApi(request, env)
      : env.ASSETS.fetch(request)
  },
}
