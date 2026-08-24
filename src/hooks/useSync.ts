import { useEffect, useState, useCallback } from 'react'
import { SyncService, SyncStatus, SyncResult } from '@/lib/sync/sync-service'

let syncServiceInstance: SyncService | null = null

function getSyncService(): SyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new SyncService()
  }
  return syncServiceInstance
}

export function useSync() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)

  const service = getSyncService()

  useEffect(() => {
    const init = async () => {
      await service.initialize()
      setIsInitialized(true)
      const newStatus = await service.getStatus()
      setStatus(newStatus)
    }
    init()
  }, [service])

  const sync = useCallback(async (direction: 'push' | 'pull' | 'bidirectional' = 'bidirectional'): Promise<SyncResult> => {
    setIsSyncing(true)
    try {
      let result: SyncResult
      if (direction === 'push') {
        result = await service.pushAll()
      } else if (direction === 'pull') {
        result = await service.pullAll()
      } else {
        result = await service.syncAll()
      }
      setLastResult(result)
      const newStatus = await service.getStatus()
      setStatus(newStatus)
      return result
    } finally {
      setIsSyncing(false)
    }
  }, [service])

  const refreshStatus = useCallback(async () => {
    const newStatus = await service.getStatus()
    setStatus(newStatus)
  }, [service])

  const registerChange = useCallback(async (model: string, uuid: string) => {
    await service.registerChange(model, uuid)
    await refreshStatus()
  }, [service, refreshStatus])

  return {
    isInitialized,
    isSyncing,
    status,
    lastResult,
    sync,
    refreshStatus,
    registerChange
  }
}
