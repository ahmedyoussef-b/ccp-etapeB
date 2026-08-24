'use client'

import { useEffect, useRef } from 'react'
import { useSync } from '@/hooks/useSync'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function SyncButton() {
  const { isSyncing, sync, lastResult, status } = useSync()
  const toastRef = useRef(toast)

  useEffect(() => {
    if (!lastResult) return
    if (lastResult.success) {
      toastRef.current.success(`Synchronisation réussie : ${lastResult.pushed} poussés, ${lastResult.pulled} tirés`)
    } else if (lastResult.errors.length > 0) {
      toastRef.current.error(`${lastResult.errors.length} erreur(s) de synchronisation`)
    }
  }, [lastResult])

  const pendingCount = status?.pendingCount ?? 0

  return (
    <Button
      onClick={() => sync('bidirectional')}
      disabled={isSyncing}
      className="relative"
    >
      <RefreshCw className={cn('h-4 w-4 mr-2', isSyncing && 'animate-spin')} />
      {isSyncing ? 'Synchronisation...' : 'Synchroniser'}
      {pendingCount > 0 && !isSyncing && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}
    </Button>
  )
}
