import React, { useEffect, useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { captureOutbox } from '../../../services/offline/captureOutbox'
import { flushPendingCaptures } from '../services/assistant.service'

/**
 * Small badge showing captures waiting in the offline outbox.
 * Renders nothing when the queue is empty. Tapping it retries the sync.
 */
const PendingSyncBadge: React.FC = () => {
  const [count, setCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => captureOutbox.subscribe(setCount), [])

  if (count === 0) return null

  const handleRetry = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      await flushPendingCaptures()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleRetry}
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 transition-colors hover:bg-amber-100"
      aria-label={`${count} captures waiting to sync — tap to retry`}
    >
      {syncing ? <RefreshCw size={12} className="animate-spin" /> : <CloudOff size={12} />}
      {count} waiting to sync
    </button>
  )
}

export default PendingSyncBadge
