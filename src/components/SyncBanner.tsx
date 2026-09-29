import { Cloud } from 'lucide-react'
import type { SyncStatus } from '../lib/useSync'

export function SyncBanner({
  status,
  remoteCount,
  onUseDevice,
  onUseShared,
}: {
  status: SyncStatus
  remoteCount: number
  onUseDevice: () => void
  onUseShared: () => void
}) {
  if (status === 'starting' || status === 'local') return null
  if (status === 'synced' || status === 'saving')
    return (
      <p className="sync-status" role="status">
        <Cloud size={14} />
        {status === 'saving' ? 'Saving to your shared library…' : 'Shared library is up to date'}
      </p>
    )
  if (status === 'offline')
    return (
      <p className="sync-status" role="status">
        <Cloud size={14} />
        Can’t reach the shared library. Your changes are kept on this device and will be saved when
        the connection returns.
      </p>
    )
  const text =
    status === 'upload'
      ? 'Your shared library is empty. Save the library on this device there so every computer and phone sees the same books?'
      : status === 'choose'
        ? `This device has its own library, and the shared library already has ${remoteCount} records. Which should you keep?`
        : 'The shared library was changed on another device, and this device has changes too. Which should you keep?'
  return (
    <div className="error sync-choice" role="alert">
      <p>{text}</p>
      <button onClick={onUseDevice}>
        {status === 'upload'
          ? 'Save this library to the shared library'
          : 'Keep this device’s version'}
      </button>
      {status !== 'upload' && <button onClick={onUseShared}>Use the shared version</button>}
    </div>
  )
}
