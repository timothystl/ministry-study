import { useCallback, useEffect, useRef, useState } from 'react'
import type { Library } from './model'
import {
  chunkChanges,
  diffRecords,
  hashRecords,
  libraryToRecords,
  recordKey,
  recordsToLibrary,
  type Hashes,
  type SyncRecord,
} from './sync'

export type SyncStatus =
  | 'starting'
  | 'local' // no shared database reachable; the library stays on this device
  | 'synced'
  | 'saving'
  | 'offline'
  | 'upload' // shared database is empty and this device has a library
  | 'choose' // both have a library and this device has never synced
  | 'conflict' // shared library changed elsewhere while this device also changed
const SYNC_KEY = 'ministry-study.sync.v1'
interface Baseline {
  revision: number
  hashes: Hashes
}
interface Remote extends Baseline {
  records: SyncRecord[]
}
function loadBaseline(): Baseline | null {
  try {
    const value = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null')
    return value && typeof value.revision === 'number' && value.hashes ? value : null
  } catch {
    return null
  }
}
function saveBaseline(baseline: Baseline) {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(baseline))
  } catch {
    // Without a saved baseline the next start simply asks again.
  }
}
async function fetchRemote(): Promise<Remote | 'unavailable'> {
  try {
    const response = await fetch('/api/library', { headers: { Accept: 'application/json' } })
    if (!(response.headers.get('Content-Type') || '').includes('json')) return 'unavailable'
    if (!response.ok) return 'unavailable'
    const body = (await response.json()) as { revision: number; records: SyncRecord[] }
    return { revision: body.revision, records: body.records, hashes: hashRecords(body.records) }
  } catch {
    return 'unavailable'
  }
}

export function useSync(library: Library, adopt: (library: Library) => boolean) {
  const [status, setStatus] = useState<SyncStatus>('starting')
  const [remoteCount, setRemoteCount] = useState(0)
  const baseline = useRef<Baseline>({ revision: 0, hashes: {} })
  const remote = useRef<Remote | null>(null)
  const latest = useRef(library)
  const busy = useRef(false)
  const active = useRef(false)
  useEffect(() => {
    latest.current = library
  }, [library])

  const push = useCallback(async () => {
    if (busy.current || !active.current) return
    busy.current = true
    try {
      for (;;) {
        const records = libraryToRecords(latest.current)
        const change = diffRecords(records, baseline.current.hashes)
        if (!change.upserts.length && !change.deletes.length) {
          setStatus('synced')
          return
        }
        setStatus('saving')
        for (const chunk of chunkChanges(change)) {
          const response = await fetch('/api/changes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ baseRevision: baseline.current.revision, ...chunk }),
          })
          if (response.status === 409) {
            active.current = false
            const fresh = await fetchRemote()
            remote.current = fresh === 'unavailable' ? null : fresh
            setRemoteCount(remote.current?.records.length ?? 0)
            setStatus('conflict')
            return
          }
          if (!response.ok) throw new Error('save failed')
          const { revision } = (await response.json()) as { revision: number }
          const hashes = { ...baseline.current.hashes }
          for (const r of chunk.upserts) hashes[recordKey(r)] = hashRecords([r])[recordKey(r)]
          for (const r of chunk.deletes) delete hashes[recordKey(r)]
          baseline.current = { revision, hashes }
          saveBaseline(baseline.current)
        }
      }
    } catch {
      setStatus('offline')
    } finally {
      busy.current = false
    }
  }, [])

  // On start: decide whether to adopt the shared library, offer to upload, or ask.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const found = await fetchRemote()
      if (cancelled) return
      if (found === 'unavailable') {
        setStatus(loadBaseline() ? 'offline' : 'local')
        return
      }
      remote.current = found
      setRemoteCount(found.records.length)
      const saved = loadBaseline()
      const local = latest.current
      const localRecords = libraryToRecords(local)
      const localEmpty = localRecords.length === 0 // only illustrative samples, or nothing
      const localHashes = hashRecords(localRecords)
      const same =
        Object.keys(localHashes).length === Object.keys(found.hashes).length &&
        Object.entries(localHashes).every(([k, v]) => found.hashes[k] === v)
      const dirty = saved ? diffRecords(libraryToRecords(local), saved.hashes) : null
      const localChanged = dirty && (dirty.upserts.length > 0 || dirty.deletes.length > 0)
      const takeRemote = () => {
        baseline.current = { revision: found.revision, hashes: found.hashes }
        if (adopt(recordsToLibrary(found.records))) {
          saveBaseline(baseline.current)
          active.current = true
          setStatus('synced')
        } else setStatus('choose')
      }
      if (found.records.length === 0) {
        if (localEmpty) {
          baseline.current = { revision: found.revision, hashes: {} }
          active.current = true
          setStatus('synced')
        } else setStatus('upload')
      } else if (same) {
        baseline.current = { revision: found.revision, hashes: found.hashes }
        saveBaseline(baseline.current)
        active.current = true
        setStatus('synced')
      } else if (localEmpty) takeRemote()
      else if (!saved) setStatus('choose')
      else if (saved.revision === found.revision) {
        baseline.current = saved
        active.current = true
        if (localChanged) void push()
        else setStatus('synced')
      } else if (!localChanged) takeRemote()
      else setStatus('conflict')
    })()
    return () => {
      cancelled = true
    }
  }, [adopt, push])

  // After each edit, save the changes shortly afterward; retry when the connection returns.
  useEffect(() => {
    if (!active.current) return
    const timer = setTimeout(() => void push(), 700)
    return () => clearTimeout(timer)
  }, [library, push])
  useEffect(() => {
    const retry = () => {
      if (status === 'offline') {
        active.current = true
        void push()
      }
    }
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [status, push])

  // Replace what is shared with this device's library.
  const keepThisDevice = useCallback(async () => {
    const found = remote.current
    baseline.current = found
      ? { revision: found.revision, hashes: found.hashes }
      : { revision: 0, hashes: {} }
    active.current = true
    await push()
  }, [push])
  // Replace this device's library with the shared one.
  const takeShared = useCallback(() => {
    const found = remote.current
    if (!found) return
    try {
      const next = recordsToLibrary(found.records)
      baseline.current = { revision: found.revision, hashes: found.hashes }
      if (adopt(next)) {
        saveBaseline(baseline.current)
        active.current = true
        setStatus('synced')
      }
    } catch {
      setStatus('offline')
    }
  }, [adopt])
  return { status, remoteCount, keepThisDevice, takeShared }
}
