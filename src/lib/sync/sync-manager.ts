// ==================== IMPORTS ====================
import { type SyncResult } from './sync-service'
import { initSqlite, getDb, query, queryOne, run } from '@/lib/client-engine'
import { initVectorStore, getVectorDB, vectorSyncHelpers } from '@/lib/client-engine/vector-store'
import { initJsonStore } from '@/lib/client-engine/json-store'

// ==================== TYPES ====================
export type DataPriority = 3 | 2 | 1

export interface SyncRecord {
  id: string
  model: string
  uuid: string
  operation: 'create' | 'update' | 'delete'
  data: unknown
  priority: DataPriority
  timestamp: number
  syncStatus: 'pending' | 'synced' | 'deleted' | 'conflict'
}

export interface SyncTableResult {
  table: string
  pushed: number
  pulled: number
  conflicts: string[]
  errors: string[]
}

export interface SyncManagerStatus {
  lastSyncTimestamp: Date | null
  isOnline: boolean
  stores: {
    postgresql: boolean
    sqlite: boolean
    indexeddb: boolean
  }
  pendingByStore: {
    postgresql: number
    sqlite: number
    indexeddb: number
  }
  conflicts: string[]
}

export interface ConflictResolution {
  uuid: string
  model: string
  resolution: 'keep_local' | 'keep_remote' | 'merge' | 'last_write_wins'
  resolvedAt: Date
}

// ==================== CONSTANTS ====================
const SYNCABLE_TABLES = [
  'procedures',
  'procedure_required_roles',
  'procedure_safety_instructions',
  'procedure_tags',
  'procedure_versions',
  'approvals',
  'tree_nodes',
  'qa_registries',
  'qa_pairs',
  'media_items',
  'media_item_tags',
  'iot_sensor_states',
  'iot_actuator_states',
]

// ==================== LOGGER ====================
const logger = {
  sync: (action: string, data?: unknown) =>
    console.log(`[DB:SYNC-MANAGER] ${action}`, data ? JSON.stringify(data, null, 2) : ''),
  syncError: (action: string, error: unknown) =>
    console.error(`[DB:SYNC-MANAGER] [ERROR] ${action}`, error instanceof Error ? error.message : String(error)),
}

// ==================== SYNC MANAGER ====================
export class SyncManager {
  private static instance: SyncManager | null = null
  private initialized: boolean = false
  private lastSyncTimestamp: Date | null = null
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true
  private conflictResolutions: Map<string, ConflictResolution> = new Map()

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager()
    }
    return SyncManager.instance
  }

  // ==================== INITIALIZATION ====================

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
        initJsonStore(),
      ])

      const failures = results
        .map((r, i) => ({ store: ['sqlite', 'vector', 'json'][i], status: r.status }))
        .filter(r => r.status === 'rejected')

      if (failures.length > 0) {
        logger.syncError('initialize_partial_failure', failures)
      }

      this.initialized = true
      logger.sync('initialized', { tables: SYNCABLE_TABLES, status: 'ready', failures })
      return failures.length === 0
    } catch (error) {
      logger.syncError('initialize_failed', error)
      return false
    }
  }

  // ==================== PUBLIC API ====================

  async syncAll(): Promise<SyncResult> {
    logger.sync('syncAll_started', { isOnline: this.isOnline })

    if (!this.initialized) {
      const initialized = await this.initialize()
      if (!initialized) {
        return this.createErrorResult('Sync manager initialization failed')
      }
    }

    if (!this.isOnline) {
      logger.sync('[OFFLINE] sync queued')
      return {
        success: false,
        pushed: 0,
        pulled: 0,
        conflicts: [],
        errors: ['Offline: sync queued for later'],
        timestamp: new Date(),
      }
    }

    const startTime = Date.now()
    const result: SyncResult = {
      success: true,
      pushed: 0,
      pulled: 0,
      conflicts: [],
      errors: [],
      timestamp: new Date(),
    }

    try {
      // Phase 1 : Push local changes vers PostgreSQL
      const pushResult = await this.pushAll()
      result.pushed = pushResult.pushed
      result.conflicts.push(...pushResult.conflicts)
      result.errors.push(...pushResult.errors)

      // Phase 2 : Pull remote changes depuis PostgreSQL
      const pullResult = await this.pullAll()
      result.pulled = pullResult.pulled
      result.errors.push(...pullResult.errors)

      // Phase 3 : Update IndexedDB vector store
      const vectorResult = await this.syncVectorStore()
      result.pulled += vectorResult.pulled
      result.errors.push(...vectorResult.errors)

      result.success = result.errors.length === 0 && (result.pushed > 0 || result.pulled > 0)
      this.lastSyncTimestamp = new Date()

      logger.sync('syncAll_completed', {
        success: result.success,
        pushed: result.pushed,
        pulled: result.pulled,
        conflicts: result.conflicts.length,
        errors: result.errors.length,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.syncError('syncAll_failed', error)
      result.success = false
      result.errors.push(errorMsg)
    }

    return result
  }

  async syncTable(tableName: string): Promise<SyncTableResult> {
    logger.sync('syncTable_started', { table: tableName })

    if (!this.initialized) {
      const initialized = await this.initialize()
      if (!initialized) {
        return { table: tableName, pushed: 0, pulled: 0, conflicts: [], errors: ['Initialization failed'] }
      }
    }

    const result: SyncTableResult = {
      table: tableName,
      pushed: 0,
      pulled: 0,
      conflicts: [],
      errors: [],
    }

    try {
      const pushResult = await this.pushTable(tableName)
      result.pushed = pushResult.pushed
      result.conflicts = pushResult.conflicts
      result.errors = pushResult.errors

      const pullResult = await this.pullTable(tableName)
      result.pulled = pullResult.pulled
      result.errors.push(...pullResult.errors)

      logger.sync('syncTable_completed', result)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.syncError('syncTable_failed', { table: tableName, error: errorMsg })
      result.errors.push(errorMsg)
    }

    return result
  }

  async getSyncStatus(): Promise<SyncManagerStatus> {
    if (!this.ensureInitialized()) {
      return {
        lastSyncTimestamp: null,
        isOnline: this.isOnline,
        stores: { postgresql: false, sqlite: false, indexeddb: false },
        pendingByStore: { postgresql: 0, sqlite: 0, indexeddb: 0 },
        conflicts: [],
      }
    }

    const db = getDb()
    const vectorDb = getVectorDB()

    const stores = {
      postgresql: true,
      sqlite: db !== null,
      indexeddb: vectorDb !== null,
    }

    let sqlitePending = 0
    let indexeddbPending = 0

    if (db) {
      for (const table of SYNCABLE_TABLES) {
        try {
          const count = await this.getPendingCount(table)
          sqlitePending += count
        } catch {
          // ignore
        }
      }
    }

    if (vectorDb) {
      try {
        const pendingDocs = await vectorSyncHelpers.getPending('documents')
        const pendingChunks = await vectorSyncHelpers.getPending('chunks')
        indexeddbPending = pendingDocs.length + pendingChunks.length
      } catch {
        // ignore
      }
    }

    const conflicts = Array.from(this.conflictResolutions.values()).map(c => c.uuid)

    return {
      lastSyncTimestamp: this.lastSyncTimestamp,
      isOnline: this.isOnline,
      stores,
      pendingByStore: {
        postgresql: 0,
        sqlite: sqlitePending,
        indexeddb: indexeddbPending,
      },
      conflicts,
    }
  }

  async resolveConflicts(strategy: 'last_write_wins' | 'manual' = 'last_write_wins'): Promise<{ resolved: number; skipped: number }> {
    logger.sync('resolveConflicts_started', { strategy, count: this.conflictResolutions.size })

    let resolved = 0
    let skipped = 0

    for (const [uuid, conflict] of this.conflictResolutions) {
      try {
        if (strategy === 'last_write_wins') {
          await this.applyLastWriteWins(conflict)
        } else {
          await this.applyManualResolution(conflict)
        }
        this.conflictResolutions.delete(uuid)
        resolved++
      } catch (error) {
        logger.syncError('resolveConflict_failed', { uuid, error })
        skipped++
      }
    }

    logger.sync('resolveConflicts_completed', { resolved, skipped })
    return { resolved, skipped }
  }

  setOnlineStatus(online: boolean): void {
    this.isOnline = online
    logger.sync('setOnlineStatus', { online })
  }

  destroy(): void {
    this.conflictResolutions.clear()
    this.initialized = false
    this.lastSyncTimestamp = null
    logger.sync('destroyed')
  }

  isInitialized(): boolean {
    return this.initialized
  }

  // ==================== PUSH / PULL ====================

  private async pushAll(): Promise<{ pushed: number; conflicts: string[]; errors: string[] }> {
    const result: { pushed: number; conflicts: string[]; errors: string[] } = { pushed: 0, conflicts: [], errors: [] }

    for (const table of SYNCABLE_TABLES) {
      try {
        const tableResult = await this.pushTable(table)
        result.pushed += tableResult.pushed
        result.conflicts.push(...tableResult.conflicts)
        result.errors.push(...tableResult.errors)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logger.syncError('pushTable_error', { table, error: errorMsg })
        result.errors.push(`${table}: ${errorMsg}`)
      }
    }

    return result
  }

  private async pushTable(tableName: string): Promise<{ pushed: number; conflicts: string[]; errors: string[] }> {
    const result: { pushed: number; conflicts: string[]; errors: string[] } = { pushed: 0, conflicts: [], errors: [] }
    const db = getDb()

    if (!db) {
      return { ...result, errors: ['Database not available'] }
    }

    try {
      const pendingRecords = await this.getPendingRecords(tableName)
      if (pendingRecords.length === 0) {
        return result
      }

      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: tableName,
          records: pendingRecords.map(r => ({
            ...r,
            syncStatus: undefined,
            deletedAt: r.deleted_at || undefined,
          })),
          deletedUuids: [],
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const responseData = await response.json()
      const accepted = responseData.accepted || 0
      const conflicts = responseData.conflicts || []

      for (const record of pendingRecords) {
        const uuid = String(record.uuid || record.id || '')
        if (uuid && !conflicts.includes(uuid)) {
          await this.markAsSynced(tableName, uuid)
        } else if (conflicts.includes(uuid)) {
          this.conflictResolutions.set(uuid, {
            uuid,
            model: tableName,
            resolution: 'last_write_wins',
            resolvedAt: new Date(),
          })
        }
      }

      result.pushed = accepted
      result.conflicts = conflicts
      logger.sync('pushTable_completed', { table: tableName, pushed: accepted, conflicts: conflicts.length })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.syncError('pushTable_failed', { table: tableName, error: errorMsg })
      result.errors.push(errorMsg)
    }

    return result
  }

  private async pullAll(): Promise<{ pulled: number; errors: string[] }> {
    const result: { pulled: number; errors: string[] } = { pulled: 0, errors: [] }

    for (const table of SYNCABLE_TABLES) {
      try {
        const tableResult = await this.pullTable(table)
        result.pulled += tableResult.pulled
        result.errors.push(...tableResult.errors)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logger.syncError('pullTable_error', { table, error: errorMsg })
        result.errors.push(`${table}: ${errorMsg}`)
      }
    }

    return result
  }

  private async pullTable(tableName: string): Promise<{ pulled: number; errors: string[] }> {
    const result: { pulled: number; errors: string[] } = { pulled: 0, errors: [] }
    const db = getDb()

    if (!db) {
      return { ...result, errors: ['Database not available'] }
    }

    try {
      const since = this.lastSyncTimestamp?.toISOString() || undefined
      const params = new URLSearchParams()
      params.set('models', tableName)
      params.set('limit', '500')
      if (since) {
        params.set('since', since)
      }

      const response = await fetch(`/api/sync/pull?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      const records = data.models?.[tableName]?.records || []

      for (const record of records) {
        try {
          await this.upsertLocalRecord(tableName, record)
          result.pulled++
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          logger.syncError('pullTable_upsert_failed', { table: tableName, error: errorMsg })
          result.errors.push(`${tableName}: ${errorMsg}`)
        }
      }

      logger.sync('pullTable_completed', { table: tableName, pulled: result.pulled })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.syncError('pullTable_failed', { table: tableName, error: errorMsg })
      result.errors.push(errorMsg)
    }

    return result
  }

  private async syncVectorStore(): Promise<{ pulled: number; errors: string[] }> {
    const result: { pulled: number; errors: string[] } = { pulled: 0, errors: [] }
    const vectorDb = getVectorDB()

    if (!vectorDb) {
      return result
    }

    try {
      const pendingDocs = await vectorSyncHelpers.getPending('documents')
      for (const doc of pendingDocs) {
        try {
          await vectorSyncHelpers.markAsSynced('documents', String(doc.id))
          result.pulled++
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          logger.syncError('syncVectorStore_document_failed', { error: errorMsg })
          result.errors.push(`vector: ${errorMsg}`)
        }
      }

      const pendingChunks = await vectorSyncHelpers.getPending('chunks')
      for (const chunk of pendingChunks) {
        try {
          await vectorSyncHelpers.markAsSynced('chunks', String(chunk.id))
          result.pulled++
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          logger.syncError('syncVectorStore_chunk_failed', { error: errorMsg })
          result.errors.push(`vector: ${errorMsg}`)
        }
      }

      logger.sync('syncVectorStore_completed', { pulled: result.pulled })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.syncError('syncVectorStore_failed', error)
      result.errors.push(errorMsg)
    }

    return result
  }

  // ==================== CONFLICT RESOLUTION ====================

  private async applyLastWriteWins(conflict: ConflictResolution): Promise<void> {
    const db = getDb()
    if (!db) return

    const tableName = conflict.model
    const record = await this.findRecordByUuid(tableName, conflict.uuid)

    if (record) {
      await this.markAsSynced(tableName, conflict.uuid)
      logger.sync('conflict_resolved_last_write_wins', { uuid: conflict.uuid, table: tableName })
    }
  }

  private async applyManualResolution(conflict: ConflictResolution): Promise<void> {
    const db = getDb()
    if (!db) return

    const tableName = conflict.model

    if (conflict.resolution === 'keep_local') {
      await this.markAsSynced(tableName, conflict.uuid)
    } else if (conflict.resolution === 'keep_remote') {
      await this.markAsSynced(tableName, conflict.uuid)
    } else if (conflict.resolution === 'merge') {
      await this.markAsSynced(tableName, conflict.uuid)
    }

    logger.sync('conflict_resolved_manual', { uuid: conflict.uuid, table: tableName, resolution: conflict.resolution })
  }

  // ==================== HELPERS ====================

  private ensureInitialized(): boolean {
    if (!this.initialized) {
      logger.syncError('not_initialized', 'Call initialize() first')
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
      timestamp: new Date(),
    }
  }

  private async getPendingRecords(tableName: string): Promise<Record<string, unknown>[]> {
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM ${tableName} WHERE sync_status = 'pending' OR sync_status = 'conflict' OR sync_status IS NULL`
    )
    return rows
  }

  private async getPendingCount(tableName: string): Promise<number> {
    const result = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${tableName} WHERE sync_status = 'pending' OR sync_status = 'conflict' OR sync_status IS NULL`
    )
    return result?.count ?? 0
  }

  private async markAsSynced(tableName: string, uuid: string): Promise<void> {
    await run(
      `UPDATE ${tableName} SET sync_status = 'synced', updated_at = datetime('now') WHERE uuid = ?`,
      [uuid]
    )
  }

  private async findRecordByUuid(tableName: string, uuid: string): Promise<Record<string, unknown> | null> {
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM ${tableName} WHERE uuid = ? LIMIT 1`,
      [uuid]
    )
    return rows.length > 0 ? rows[0] : null
  }

  private async upsertLocalRecord(tableName: string, record: Record<string, unknown>): Promise<void> {
    const uuid = record.uuid as string | undefined
    if (!uuid) return

    const existing = await this.findRecordByUuid(tableName, uuid)
    if (existing) {
      const setClauses: string[] = []
      const values: unknown[] = []

      for (const [key, value] of Object.entries(record)) {
        if (key === 'uuid' || key === 'id') continue
        const columnName = this.escapeColumn(this.mapColumnName(tableName, key))
        setClauses.push(`${columnName} = ?`)
        values.push(value)
      }

      setClauses.push(`"sync_status" = 'synced'`)
      setClauses.push(`"updated_at" = datetime('now')`)
      values.push(uuid)

      await run(`UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE uuid = ?`, values)
    } else {
      const columns: string[] = ['"uuid"', '"sync_status"', '"created_at"', '"updated_at"']
      const placeholders: string[] = ['?', '?', "datetime('now')", "datetime('now')"]
      const values: unknown[] = [uuid, 'synced']

      for (const [key, value] of Object.entries(record)) {
        if (key === 'uuid' || key === 'id') continue
        const columnName = this.escapeColumn(this.mapColumnName(tableName, key))
        columns.push(columnName)
        placeholders.push('?')
        values.push(value)
      }

      await run(
        `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
        values
      )
    }
  }

  private mapColumnName(tableName: string, key: string): string {
    if ((tableName === 'local_tree' || tableName === 'tree_nodes') && key === 'order') {
      return 'node_order'
    }
    return this.camelToSnake(key)
  }

  private escapeColumn(name: string): string {
    return `"${name.replace(/"/g, '""')}"`
  }

  private camelToSnake(camel: string): string {
    return camel.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  }
}

// ==================== SINGLETON EXPORT ====================
export const syncManager = SyncManager.getInstance()
