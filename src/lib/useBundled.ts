import { useEffect, useRef } from 'react'
import { hymnsFromRuf, type RufEntry } from './hymns'
import type { Library } from './model'
import { BUNDLE_SOURCE, resourcesFromBundle, type BundledResource } from './resources'

// The RUF Hymnbook index and the Retuned Hymn Movement list are added to the library by
// themselves, once, after the shared library has loaded. Each is added only if none of its records
// are there yet, so anything removed afterward stays removed. Their ids are fixed, so two devices
// doing this at once cannot create duplicates.
const DONE = 'ministry-study.bundled.v1'
async function json<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(path)
  return (await response.json()) as T
}
export function planBundled(
  library: Library,
  ruf: RufEntry[] | null,
  resources: BundledResource[] | null,
): Library | null {
  const hymns =
    ruf && !library.hymns.some((h) => h.source === 'RUF Hymnbook')
      ? hymnsFromRuf(ruf, library).hymns
      : []
  const more =
    resources && !library.resources.some((r) => r.source === BUNDLE_SOURCE)
      ? resourcesFromBundle(resources, library).resources
      : []
  if (!hymns.length && !more.length) return null
  return {
    ...library,
    hymns: [...library.hymns, ...hymns],
    resources: [...library.resources, ...more],
  }
}
export function useBundled(
  library: Library,
  commit: (library: Library) => boolean,
  ready: boolean,
) {
  const latest = useRef(library)
  const save = useRef(commit)
  const started = useRef(false)
  useEffect(() => {
    latest.current = library
    save.current = commit
  })
  useEffect(() => {
    if (!ready || started.current) return
    started.current = true
    try {
      if (localStorage.getItem(DONE)) return
    } catch {
      // Without local storage the check simply runs each visit; it adds nothing twice.
    }
    void (async () => {
      try {
        const [ruf, resources] = await Promise.all([
          json<RufEntry[]>('/data/ruf-hymnbook.json'),
          json<BundledResource[]>('/data/retuned-resources.json'),
        ])
        const next = planBundled(latest.current, ruf, resources)
        if (next && !save.current(next)) return
        try {
          localStorage.setItem(DONE, '1')
        } catch {
          // fine
        }
      } catch {
        started.current = false // try again on the next start
      }
    })()
  }, [ready])
}
