// ==================== IMPORTS ====================
import { generateUUID } from '@/lib/uuid'
import { getDb, sqliteSyncHelpers, sqliteCrud, initSqlite } from '@/lib/client-engine'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { initVectorStore, vectorSyncHelpers } from '@/lib/client-engine/vector-store'
import { initJsonStore } from '@/lib/client-engine/json-store'

// ==================== LOGGER ====================
const logger = {
  sync: (action: string, data?: unknown) =>
    console.log(`[DB:SYNC] ${action}`, data ? JSON.stringify(data, null, 2) : ''),
  syncError: (action: string, error: unknown) =>
    console.error(`[DB:SYNC] [ERROR] ${action}`, error)
}

// ==================== MODEL → TABLE MAPPING ====================
const MODEL_TABLE_MAP: Record<string, string> = {
  procedures: 'procedures',
  procedure_required_roles: 'procedure_required_roles',
  procedure_safety_instructions: 'procedure_safety_instructions',
  procedure_tags: 'procedure_tags',
  procedure_versions: 'procedure_versions',
  approvals: 'approvals',
  tree_nodes: 'local_tree',
  qa_registries: 'qa_registries',
  qa_pairs: 'qa_pairs',
  media_items: 'media_items',
  media_item_tags: 'media_item_tags',
  iot_sensor_states: 'iot_sensor_states',
  iot_actuator_states: 'iot_actuator_states',
  sync_logs: 'sync_logs',
}

const SYNCABLE_MODELS = Object.keys(MODEL_TABLE_MAP)

// ==================== TYPES ====================
export interface SyncStatus {
  lastSyncTimestamp: Date | null
  pendingCount: number
  conflicts: string[]
  isOnline: boolean
  models: {
    procedures: number
    executions: number
    tree: number
    qr: number
    media: number
    iot: number
  }
}

export interface SyncResult {
  success: boolean
  pushed: number
  pulled: number
  conflicts: string[]
  errors: string[]
  timestamp: Date
}

export enum SyncDirection {
  PUSH = 'push',
  PULL = 'pull',
  BIDIRECTIONAL = 'bidirectional'
}

interface ModelSyncResult {
  model: string
  pushed: number
  pulled: number
  conflicts: string[]
  errors: string[]
}

interface OfflineChange {
  id: string
  model: string
  uuid: string
  operation: 'create' | 'update' | 'delete'
  data?: unknown
  timestamp: Date
  retryCount: number
}

// ==================== SYNC SERVICE ====================
export class SyncService {
  private static instance: SyncService | null = null
  private initialized: boolean = false
  private lastSyncTimestamp: Date | null = null
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true
  private offlineQueue: OfflineChange[] = []
  private flushInterval: ReturnType<typeof setInterval> | null = null
  private isFlushing: boolean = false

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService()
    }
    return SyncService.instance
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) {
      logger.sync('already_initialized')
      return true
    }

    logger.sync('initialize_started')

    try {
      const results = await Promise.allSettled([
        initSqlite(),
        initVectorStore(),
        initJsonStore()
      ])

      const failures = results
        .map((r, i) => ({ store: ['sqlite', 'vector', 'json'][i], status: r.status }))
        .filter(r => r.status === 'rejected')

      if (failures.length > 0) {
        logger.syncError('initialize_partial_failure', failures)
      }

      this.initialized = true
      logger.sync('initialize_completed', { failures })
      return failures.length === 0
    } catch (error) {
      logger.syncError('initialize_failed', error)
      return false
    }
  }

  async pushAll(): Promise<SyncResult> {
    if (!this.ensureInitialized()) {
      return this.createErrorResult('Local stores not initialized')
    }

    logger.sync('pushAll_started')
    const startTime = new Date()
    const result: SyncResult = {
      success: true,
      pushed: 0,
      pulled: 0,
      conflicts: [],
      errors: [],
      timestamp: startTime
    }

    const modelResults: ModelSyncResult[] = []

    for (const model of SYNCABLE_MODELS) {
      try {
        const modelResult = await this.pushModel(model)
        modelResults.push(modelResult)
        result.pushed += modelResult.pushed
        result.conflicts.push(...modelResult.conflicts)
        result.errors.push(...modelResult.errors)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logger.syncError(`pushModel_${model}`, error)
        result.errors.push(`${model}: ${errorMsg}`)
        modelResults.push({ model, pushed: 0, pulled: 0, conflicts: [], errors: [errorMsg] })
      }
    }

    const allSuccessful = modelResults.every(mr => mr.errors.length === 0)
    result.success = allSuccessful && result.pushed > 0
    this.lastSyncTimestamp = new Date()

    logger.sync('pushAll_completed', {
      totalPushed: result.pushed,
      totalConflicts: result.conflicts.length,
      totalErrors: result.errors.length,
      duration: Date.now() - startTime.getTime()
    })

    return result
  }

  async pullAll(): Promise<SyncResult> {
    if (!this.ensureInitialized()) {
      return this.createErrorResult('Local stores not initialized')
    }

    logger.sync('pullAll_started')
    const startTime = new Date()
    const result: SyncResult = {
      success: true,
      pushed: 0,
      pulled: 0,
      conflicts: [],
      errors: [],
      timestamp: startTime
    }

    try {
      const params = new URLSearchParams()
      params.set('models', 'tree_nodes,iot_sensor_states,iot_actuator_states')
      params.set('limit', '500')

      const response = await fetch(`/api/sync/pull?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      const treeNodes = data.models?.tree_nodes?.records || []
      const iotSensorStates = data.models?.iot_sensor_states?.records || []
      const iotActuatorStates = data.models?.iot_actuator_states?.records || []
      const iotDeletedUuids = data.models?.iot_sensor_states?.deletedUuids || []

      let pulledCount = 0

      if (treeNodes.length > 0) {
        pulledCount += await this.importTreeNodesToLocal(treeNodes)
      }

      if (iotSensorStates.length > 0 || iotActuatorStates.length > 0) {
        pulledCount += await this.syncIotStatesFromPull({
          sensors: iotSensorStates,
          actuators: iotActuatorStates,
          deletedUuids: iotDeletedUuids,
        })
      }

      result.pulled = pulledCount
      result.success = true
      this.lastSyncTimestamp = new Date()

      logger.sync('pullAll_completed', {
        pulledCount,
        treeNodes: treeNodes.length,
        sensors: iotSensorStates.length,
        actuators: iotActuatorStates.length,
        duration: Date.now() - startTime.getTime()
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.syncError('pullAll_failed', error)
      result.success = false
      result.errors.push(errorMsg)
    }

    return result
  }

  async syncAll(): Promise<SyncResult> {
    logger.sync('syncAll_started', { direction: SyncDirection.BIDIRECTIONAL, isOnline: this.isOnline })

    if (!this.isOnline) {
      logger.sync('[OFFLINE] sync queued offline')
      return {
        success: false,
        pushed: 0,
        pulled: 0,
        conflicts: [],
        errors: ['Offline: sync queued for later'],
        timestamp: new Date()
      }
    }

    await this.flushOfflineQueue()

    const pushResult = await this.pushAll()
    const pullResult = await this.pullAll()

    const result: SyncResult = {
      success: pushResult.success && pullResult.success,
      pushed: pushResult.pushed,
      pulled: pullResult.pulled,
      conflicts: [...pushResult.conflicts, ...pullResult.conflicts],
      errors: [...pushResult.errors, ...pullResult.errors],
      timestamp: new Date()
    }

    logger.sync('syncAll_completed', {
      success: result.success,
      pushed: result.pushed,
      pulled: result.pulled,
      conflicts: result.conflicts.length,
      errors: result.errors.length
    })

    return result
  }

  async getStatus(): Promise<SyncStatus> {
    if (!this.ensureInitialized()) {
      return {
        lastSyncTimestamp: null,
        pendingCount: 0,
        conflicts: [],
        isOnline: this.isOnline,
        models: {
          procedures: 0,
          executions: 0,
          tree: 0,
          qr: 0,
          media: 0,
          iot: 0
        }
      }
    }

    const db = getDb()
    if (!db) {
      throw new Error('SQLite database not available')
    }

    const models = {
      procedures: 0,
      executions: 0,
      tree: 0,
      qr: 0,
      media: 0,
      iot: 0
    }

    let totalPending = 0
    const conflicts: string[] = []

    for (const [model, table] of Object.entries(MODEL_TABLE_MAP)) {
      try {
        const pending = await sqliteSyncHelpers.getPendingCount(db, table)
        totalPending += pending
        this.assignModelCount(models, model, pending)
      } catch (error) {
        logger.syncError(`getStatus_${model}`, error)
      }
    }

    const pendingRecords = await sqliteSyncHelpers.getPendingRecords(db, 'sync_logs')
    for (const record of pendingRecords) {
      if (record.operation === 'conflict') {
        conflicts.push(String(record.record_uuid || record.id))
      }
    }

    return {
      lastSyncTimestamp: this.lastSyncTimestamp,
      pendingCount: totalPending,
      conflicts,
      isOnline: this.isOnline,
      models
    }
  }

  async registerChange(model: string, uuid: string): Promise<void> {
    if (!this.ensureInitialized()) {
      logger.syncError('registerChange_not_initialized', { model, uuid })
      return
    }

    const table = MODEL_TABLE_MAP[model]
    if (!table) {
      logger.syncError('registerChange_unknown_model', { model })
      return
    }

    if (!this.isOnline) {
      await this.queueChange(model, uuid, 'update')
      return
    }

    const db = getDb()
    if (!db) {
      logger.syncError('registerChange_no_db', { model, uuid })
      return
    }

    try {
      await sqliteSyncHelpers.markAsSynced(db, table, uuid)
      logger.sync('registerChange_completed', { model, uuid, table })
    } catch (error) {
      logger.syncError('registerChange_failed', { model, uuid, error })
    }
  }

  setOnlineStatus(online: boolean): void {
    this.isOnline = online
    logger.sync('setOnlineStatus', { online })
  }

  startOfflineDetection(): void {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      this.setOnlineStatus(true)
      this.flushOfflineQueue()
    }

    const handleOffline = () => {
      this.setOnlineStatus(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    this.flushInterval = setInterval(() => {
      if (this.isOnline && this.offlineQueue.length > 0 && !this.isFlushing) {
        this.flushOfflineQueue()
      }
    }, 30000)

    logger.sync('startOfflineDetection_started')
  }

  async queueChange(model: string, uuid: string, operation: 'create' | 'update' | 'delete', data?: unknown): Promise<void> {
    const change: OfflineChange = {
      id: generateUUID(),
      model,
      uuid,
      operation,
      data,
      timestamp: new Date(),
      retryCount: 0,
    }

    this.offlineQueue.push(change)
    logger.sync('[OFFLINE] change queued', { model, uuid, operation, queueSize: this.offlineQueue.length })
  }

  async flushOfflineQueue(): Promise<{ flushed: number; errors: number }> {
    if (this.isFlushing) {
      return { flushed: 0, errors: 0 }
    }

    if (!this.isOnline || this.offlineQueue.length === 0) {
      return { flushed: 0, errors: 0 }
    }

    this.isFlushing = true
    const queue = [...this.offlineQueue]
    this.offlineQueue = []

    logger.sync('[ONLINE] flushing queued changes', { count: queue.length })

    let flushed = 0
    let errors = 0

    for (const change of queue) {
      try {
        await this.pushModel(change.model)
        flushed++
      } catch {
        errors++
        change.retryCount++
        if (change.retryCount < 3) {
          this.offlineQueue.push(change)
        } else {
          logger.syncError('[OFFLINE] max retries reached', change)
        }
      }
    }

    this.isFlushing = false
    logger.sync('[OFFLINE] flushed', { flushed, errors })

    return { flushed, errors }
  }

  getModelTable(model: string): string {
    const table = MODEL_TABLE_MAP[model]
    if (!table) {
      throw new Error(`Unknown model: ${model}. Available models: ${SYNCABLE_MODELS.join(', ')}`)
    }
    return table
  }

  getSyncableModels(): string[] {
    return [...SYNCABLE_MODELS]
  }

  isInitialized(): boolean {
    return this.initialized
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
    this.offlineQueue = []
    this.initialized = false
    logger.sync('destroyed')
  }

  // ==================== PRIVATE METHODS ====================

  private ensureInitialized(): boolean {
    if (!this.initialized) {
      logger.syncError('service_not_initialized', 'Call initialize() first')
      return false
    }
    return true
  }

  private createErrorResult(error: string): SyncResult {
    return {
      success: false,
      pushed: 0,
      pulled: 0,
      conflicts: [],
      errors: [error],
      timestamp: new Date()
    }
  }

  private async pushModel(model: string): Promise<ModelSyncResult> {
    const db = getDb()
    if (!db) {
      return { model, pushed: 0, pulled: 0, conflicts: [], errors: ['Database not available'] }
    }

    const table = MODEL_TABLE_MAP[model]
    if (!table) {
      return { model, pushed: 0, pulled: 0, conflicts: [], errors: [`Unknown model: ${model}`] }
    }

    const result: ModelSyncResult = {
      model,
      pushed: 0,
      pulled: 0,
      conflicts: [],
      errors: []
    }

    try {
      const pendingRecords = await sqliteSyncHelpers.getPendingRecords(db, table)
      if (pendingRecords.length === 0) {
        return result
      }

      const payload = {
        model,
        table,
        records: pendingRecords.map(record => ({
          ...record,
          syncStatus: undefined,
          deletedAt: record.deleted_at || undefined
        }))
      }

      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const responseData = await response.json()
      const accepted = responseData.accepted || 0
      const conflicts = responseData.conflicts || []

      for (const record of pendingRecords) {
        const uuid = String(record.uuid || '')
        if (uuid && !conflicts.includes(uuid)) {
          await sqliteSyncHelpers.markAsSynced(db, table, uuid)
        }
      }

      result.pushed = accepted
      result.conflicts = conflicts
      logger.sync(`pushModel_${model}_completed`, { pushed: accepted, conflicts: conflicts.length })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.syncError(`pushModel_${model}`, error)
      result.errors.push(errorMsg)
    }

    return result
  }

  private async importTreeNodesToLocal(nodes: Record<string, unknown>[]): Promise<number> {
    let count = 0
    const db = getDb()
    if (!db) return 0

    try {
      await sqliteCrud.delete(db, 'local_tree', 'all')

      for (const node of nodes) {
        const data = {
          uuid: node.uuid || generateUUID(),
          name: node.name || 'Sans nom',
          type: node.type === 'directory' ? 'folder' : node.type,
          metadata: node.metadata || null,
          parent_id: node.parentId || null,
          order_idx: node.order || 0,
          sync_status: 'synced',
          deleted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        await sqliteCrud.create(db, 'local_tree', data)
        count++
      }

      logger.sync('importTreeNodes_completed', { count })
    } catch (error) {
      logger.syncError('importTreeNodes_failed', error)
    }

    return count
  }

  private async syncIotStatesFromPull(iotData: { sensors?: Record<string, unknown>[]; actuators?: Record<string, unknown>[]; deletedUuids?: string[] }): Promise<number> {
    let count = 0
    const db = getDb()
    if (!db) return 0

    try {
      if (iotData.deletedUuids && iotData.deletedUuids.length > 0) {
        for (const uuid of iotData.deletedUuids) {
          try {
            await sqliteCrud.update(db, 'iot_sensor_states', uuid, {
              sync_status: 'pending',
              deleted_at: new Date().toISOString()
            })
          } catch {
            // ignore
          }
        }
      }

      if (iotData.sensors && Array.isArray(iotData.sensors)) {
        for (const sensor of iotData.sensors) {
          const s = sensor as Record<string, unknown>
          const existing = await sqliteCrud.findUnique(db, 'iot_sensor_states', String(s.uuid || s.id || ''))
          if (existing) {
            await sqliteCrud.update(db, 'iot_sensor_states', String(s.uuid || s.id || ''), {
              value: Number(s.value),
              threshold: Number(s.threshold || 0),
              updated_at: new Date().toISOString()
            })
          } else {
            await sqliteCrud.create(db, 'iot_sensor_states', {
              uuid: String(s.uuid || s.id || generateUUID()),
              name: String(s.name || ''),
              type: String(s.type || ''),
              value: Number(s.value || 0),
              unit: String(s.unit || ''),
              threshold: Number(s.threshold || 0),
              sync_status: 'synced',
              deleted_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          }
          count++
        }
      }

      if (iotData.actuators && Array.isArray(iotData.actuators)) {
        for (const actuator of iotData.actuators) {
          const a = actuator as Record<string, unknown>
          const existing = await sqliteCrud.findUnique(db, 'iot_actuator_states', String(a.uuid || a.id || ''))
          if (existing) {
            await sqliteCrud.update(db, 'iot_actuator_states', String(a.uuid || a.id || ''), {
              is_on: a.is_on ? 1 : 0,
              position: a.position ? Number(a.position) : null,
              updated_at: new Date().toISOString()
            })
          } else {
            await sqliteCrud.create(db, 'iot_actuator_states', {
              uuid: String(a.uuid || a.id || generateUUID()),
              name: String(a.name || ''),
              type: String(a.type || ''),
              is_on: a.is_on ? 1 : 0,
              position: a.position ? Number(a.position) : null,
              sync_status: 'synced',
              deleted_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          }
          count++
        }
      }

      logger.sync('syncIotStatesFromPull_completed', { count })
    } catch (error) {
      logger.syncError('syncIotStatesFromPull_failed', error)
    }

    return count
  }

  private assignModelCount(models: Record<string, number>, model: string, count: number): void {
    switch (model) {
      case 'procedures':
      case 'procedure_required_roles':
      case 'procedure_safety_instructions':
      case 'procedure_tags':
      case 'procedure_versions':
        models.procedures += count
        break
      case 'approvals':
        models.executions += count
        break
      case 'tree_nodes':
        models.tree += count
        break
      case 'qa_registries':
      case 'qa_pairs':
        models.qr += count
        break
      case 'media_items':
      case 'media_item_tags':
        models.media += count
        break
      case 'iot_sensor_states':
      case 'iot_actuator_states':
        models.iot += count
        break
      default:
        break
    }
  }
}

// ==================== SINGLETON EXPORT ====================
export const syncService = SyncService.getInstance()
