import { findPrayers, seriesPages, type Series } from './lcms'
import { verifyAccess, type AccessEnv } from './access'
import {
  checkUpload,
  deleteAttachment,
  getAttachment,
  MAX_ATTACHMENT,
  putAttachment,
  validAttachmentId,
} from './attachments'
import { usageFor } from './usage'
import { applyChanges, forbiddenKinds, readAll, validateChange } from './store'
import {
  listPeople,
  normalizeEmail,
  resolveWho,
  savePerson,
  validatePerson,
  validEmail,
} from './people'
import { SECTIONS } from './sections'
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
  // The pastor's sign-in address. Everyone else is added on the People page.
  STUDY_ADMIN_EMAIL?: string
  DB: D1Database
  ASSETS: Fetcher
}
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

export async function handleApi(
  request: Request,
  env: Env,
  verify: typeof verifyAccess = verifyAccess,
): Promise<Response> {
  const { pathname } = new URL(request.url)
  const access = await verify(request, env)
  if (access.status === 'unconfigured')
    return reply({ error: 'Sign-in protection is not set up for the shared library.' }, 503)
  if (access.status !== 'ok') return reply({ error: 'Please sign in.' }, 401)
  if (!env.STUDY_ADMIN_EMAIL && env.STUDY_DEV_NO_AUTH !== '1')
    return reply({ error: 'The administrator address (STUDY_ADMIN_EMAIL) is not set.' }, 503)
  if (!env.DB) return reply({ error: 'The shared database is not connected.' }, 503)
  try {
    const resolved = await resolveWho(
      env.DB,
      access.email,
      env.STUDY_ADMIN_EMAIL ?? '',
      env.STUDY_DEV_NO_AUTH === '1' && access.email === 'dev@localhost',
    )
    if (!resolved.ok)
      return reply(
        {
          error:
            resolved.reason === 'paused'
              ? 'Your access to the study is paused. Please contact Andrew.'
              : 'You are signed in, but have not been added to the study yet. Please contact Andrew.',
          reason: resolved.reason,
          email: normalizeEmail(access.email),
        },
        403,
      )
    const { who } = resolved
    const may = (section: string) => who.role === 'admin' || who.sections.some((s) => s === section)
    const denied = () => reply({ error: 'That part of the study is not turned on for you.' }, 403)
    if (pathname === '/api/lcms-prayer' && request.method === 'GET') {
      if (!may('prayers')) return denied()
      const params = new URL(request.url).searchParams
      const date = params.get('date') || ''
      const series = (params.get('series') || 'three') as Series
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(series in seriesPages))
        return reply({ error: 'Choose a date and a series.' }, 400)
      try {
        const prayers = await findPrayers(date, series, (url) =>
          fetch(url, { cf: { cacheTtl: 86400, cacheEverything: true } }),
        )
        return prayers.length
          ? reply({ date, series, prayers })
          : reply({ error: 'The LCMS has not posted a prayer for that date.' }, 404)
      } catch {
        return reply({ error: 'The LCMS prayers could not be read right now.' }, 502)
      }
    }
    if (pathname === '/api/me' && request.method === 'GET')
      return reply({
        email: who.email,
        name: who.name,
        role: who.role,
        sections: who.sections,
        sectionList: SECTIONS,
      })
    if (pathname === '/api/people' || pathname.startsWith('/api/people/')) {
      if (who.role !== 'admin') return reply({ error: 'Only the administrator can do that.' }, 403)
      if (pathname === '/api/people' && request.method === 'GET')
        return reply({ people: await listPeople(env.DB) })
      const route = /^\/api\/people\/([^/]+)$/.exec(pathname)
      if (route && request.method === 'PUT') {
        const email = normalizeEmail(decodeURIComponent(route[1]))
        if (!validEmail(email))
          return reply({ error: 'That does not look like an email address.' }, 400)
        if (email === normalizeEmail(env.STUDY_ADMIN_EMAIL))
          return reply({ error: 'That is your own address; you always have everything.' }, 400)
        if (!request.headers.get('Content-Type')?.includes('application/json'))
          return reply({ error: 'Send JSON.' }, 415)
        let input
        try {
          input = validatePerson(await request.json())
        } catch (error) {
          return reply({ error: (error as Error).message }, 400)
        }
        await savePerson(env.DB, email, input)
        return reply({ people: await listPeople(env.DB) })
      }
      return reply({ error: 'Not found.' }, 404)
    }
    if (pathname === '/api/library' && request.method === 'GET')
      return reply(await readAll(env.DB, who.owner, who.kinds))
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
      if (forbiddenKinds(change, who.kinds).length) return denied()
      const result = await applyChanges(env.DB, who.owner, body.baseRevision as number, change)
      return result.ok ? reply(result) : reply({ error: 'changed-elsewhere', ...result }, 409)
    }
    const isSermonRoute =
      pathname === '/api/sermon-text' ||
      pathname === '/api/sermon-search' ||
      pathname === '/api/sermon-export' ||
      pathname.startsWith('/api/sermon-text/')
    if (isSermonRoute && !may('sermons')) return denied()
    if (pathname === '/api/sermon-text' && request.method === 'GET')
      return reply(await listStatus(env.DB, who.owner))
    if (pathname === '/api/sermon-search' && request.method === 'GET') {
      const q = new URL(request.url).searchParams.get('q') || ''
      return reply(q.length > 200 ? [] : await searchText(env.DB, who.owner, q))
    }
    if (pathname === '/api/sermon-export' && request.method === 'GET') {
      const after = new URL(request.url).searchParams.get('after') || ''
      return reply(await exportAll(env.DB, who.owner, after))
    }
    const textRoute = /^\/api\/sermon-text\/([^/]+)$/.exec(pathname)
    if (textRoute) {
      const id = decodeURIComponent(textRoute[1])
      if (!validSermonId(id)) return reply({ error: 'Invalid sermon.' }, 400)
      if (request.method === 'GET') {
        const found = await getText(env.DB, who.owner, id)
        return found ? reply(found) : reply({ error: 'No text saved.' }, 404)
      }
      if (request.method === 'DELETE') {
        await deleteText(env.DB, who.owner, id)
        return reply({ ok: true })
      }
      if (request.method === 'PUT' || request.method === 'PATCH') {
        if (!request.headers.get('Content-Type')?.includes('application/json'))
          return reply({ error: 'Send JSON.' }, 415)
        const body = (await request.json()) as { indexed?: unknown }
        if (request.method === 'PATCH') {
          if (typeof body.indexed !== 'boolean')
            return reply({ error: 'Say whether to index.' }, 400)
          return (await setIndexed(env.DB, who.owner, id, body.indexed))
            ? reply({ ok: true })
            : reply({ error: 'No text saved.' }, 404)
        }
        let input
        try {
          input = validateText(body)
        } catch (error) {
          return reply({ error: (error as Error).message }, 400)
        }
        await putText(env.DB, who.owner, id, input)
        return reply({ ok: true, chars: input.text.length })
      }
    }
    if (pathname === '/api/usage' && request.method === 'GET')
      return reply(await usageFor(env.DB, who.owner))
    const fileRoute = /^\/api\/attachments\/([^/]+)$/.exec(pathname)
    if (fileRoute) {
      if (!may('hymns') && !may('sermons') && !may('ideas') && !may('visuals')) return denied()
      const id = decodeURIComponent(fileRoute[1])
      if (!validAttachmentId(id)) return reply({ error: 'Invalid file.' }, 400)
      if (request.method === 'GET') {
        const found = await getAttachment(env.DB, who.owner, id)
        if (!found) return reply({ error: 'No such file.' }, 404)
        return new Response(found.bytes, {
          headers: {
            'Content-Type': found.mime,
            'Content-Disposition': `${found.mime === 'application/octet-stream' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(found.name)}`,
            'Cache-Control': 'private, max-age=86400',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': 'sandbox',
          },
        })
      }
      if (request.method === 'DELETE') {
        await deleteAttachment(env.DB, who.owner, id)
        return reply({ ok: true })
      }
      if (request.method === 'PUT') {
        const declared = Number(request.headers.get('Content-Length') || 0)
        if (declared > MAX_ATTACHMENT)
          return reply({ error: 'That file is too large (8 MB at most).' }, 413)
        const bytes = new Uint8Array(await request.arrayBuffer())
        let name = 'file'
        try {
          name = decodeURIComponent(request.headers.get('X-File-Name') || 'file')
        } catch {
          // keep the plain name
        }
        let mime
        try {
          mime = checkUpload(bytes, request.headers.get('Content-Type') || '', name)
        } catch (error) {
          return reply({ error: (error as Error).message }, 400)
        }
        if (!(await putAttachment(env.DB, who.owner, id, name, mime, bytes)))
          return reply({ error: 'Invalid file.' }, 400)
        return reply({ ok: true, size: bytes.length, mime })
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
