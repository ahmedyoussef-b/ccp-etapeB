import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ==================== TYPES ====================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModelRecords = any[]
interface PullResponse {
  timestamp: string
  models: Record<string, { records: ModelRecords; deletedUuids: string[] }>
  hasMore: boolean
  nextSince?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModelQuery = (since?: string, limit?: number, offset?: number) => Promise<{ records: any[]; deletedUuids: (string | null)[] }>

// ==================== HELPERS ====================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildWhere(since?: string, baseWhere: any = {}): any {
  if (!since) return baseWhere
  return {
    ...baseWhere,
    OR: [
      { updatedAt: { gt: new Date(since) } },
      { syncStatus: { in: ['pending', 'local_only', 'conflict'] } },
    ],
  }
}

// ==================== MODEL QUERIES ====================
const modelQueries: Record<string, ModelQuery> = {
  procedures: async (since, limit, offset) => {
    const where = buildWhere(since, { deletedAt: null })
    const [records, deleted] = await Promise.all([
      prisma.procedure.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.procedure.findMany({
        where: { deletedAt: { not: null }, ...(since ? { deletedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  procedure_required_roles: async (since, limit, offset) => {
    const where = buildWhere(since, { deletedAt: null })
    const [records, deleted] = await Promise.all([
      prisma.procedureRequiredRole.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.procedureRequiredRole.findMany({
        where: { deletedAt: { not: null }, ...(since ? { deletedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  procedure_safety_instructions: async (since, limit, offset) => {
    const where = buildWhere(since, { deletedAt: null })
    const [records, deleted] = await Promise.all([
      prisma.procedureSafetyInstruction.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.procedureSafetyInstruction.findMany({
        where: { deletedAt: { not: null }, ...(since ? { deletedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  procedure_tags: async (since, limit, offset) => {
    const where = buildWhere(since, { deletedAt: null })
    const [records, deleted] = await Promise.all([
      prisma.procedureTag.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.procedureTag.findMany({
        where: { deletedAt: { not: null }, ...(since ? { deletedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  procedure_versions: async (since, limit, offset) => {
    const where = buildWhere(since)
    const [records, deleted] = await Promise.all([
      prisma.procedureVersion.findMany({ where, skip: offset, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.procedureVersion.findMany({
        where: { deletedAt: { not: null }, ...(since ? { deletedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  approvals: async (since, limit, offset) => {
    const where = buildWhere(since, { deletedAt: null })
    const [records, deleted] = await Promise.all([
      prisma.approval.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.approval.findMany({
        where: { deletedAt: { not: null }, ...(since ? { deletedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  tree_nodes: async (since, limit, offset) => {
    const where = buildWhere(since, { deletedAt: null })
    const [records, deleted] = await Promise.all([
      prisma.treeNode.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.treeNode.findMany({
        where: { deletedAt: { not: null }, ...(since ? { deletedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  qa_registries: async (since, limit, offset) => {
    const where = buildWhere(since, { deletedAt: null })
    const [records, deleted] = await Promise.all([
      prisma.qARegistry.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.qARegistry.findMany({
        where: { deletedAt: { not: null }, ...(since ? { deletedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  qa_pairs: async (since, limit, offset) => {
    const where = buildWhere(since, { deletedAt: null })
    const [records, deleted] = await Promise.all([
      prisma.qAPair.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.qAPair.findMany({
        where: { deletedAt: { not: null }, ...(since ? { deletedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  media_items: async (since, limit, offset) => {
    const where = buildWhere(since, { deletedAt: null })
    const [records, deleted] = await Promise.all([
      prisma.mediaItem.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.mediaItem.findMany({
        where: { deletedAt: { not: null }, ...(since ? { deletedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  media_item_tags: async (since, limit, offset) => {
    const where = buildWhere(since, { deletedAt: null })
    const [records, deleted] = await Promise.all([
      prisma.mediaItemTag.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.mediaItemTag.findMany({
        where: { deletedAt: { not: null }, ...(since ? { deletedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  iot_sensor_states: async (since, limit, offset) => {
    const where = buildWhere(since, { deletedAt: null })
    const [records, deleted] = await Promise.all([
      prisma.iotSensorState.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.iotSensorState.findMany({
        where: { deletedAt: { not: null }, ...(since ? { deletedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  iot_actuator_states: async (since, limit, offset) => {
    const where = buildWhere(since, { deletedAt: null })
    const [records, deleted] = await Promise.all([
      prisma.iotActuatorState.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.iotActuatorState.findMany({
        where: { deletedAt: { not: null }, ...(since ? { deletedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  procedure_executions: async (since, limit, offset) => {
    const where = buildWhere(since, { deletedAt: null })
    const [records, deleted] = await Promise.all([
      prisma.procedureExecution.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.procedureExecution.findMany({
        where: { deletedAt: { not: null }, ...(since ? { deletedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  execution_steps: async (since, limit, offset) => {
    const where = buildWhere(since)
    const [records, deleted] = await Promise.all([
      prisma.executionStep.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.executionStep.findMany({
        where: { ...(since ? { updatedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  execution_media: async (since, limit, offset) => {
    const where = buildWhere(since)
    const [records, deleted] = await Promise.all([
      prisma.executionMedia.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.executionMedia.findMany({
        where: { ...(since ? { updatedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  execution_completed_steps: async (since, limit, offset) => {
    const where = buildWhere(since)
    const [records, deleted] = await Promise.all([
      prisma.executionCompletedStep.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.executionCompletedStep.findMany({
        where: { ...(since ? { updatedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  execution_anomalies: async (since, limit, offset) => {
    const where = buildWhere(since)
    const [records, deleted] = await Promise.all([
      prisma.executionAnomaly.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.executionAnomaly.findMany({
        where: { ...(since ? { updatedAt: { gt: new Date(since) } } : {}) },
        select: { uuid: true },
        skip: offset,
        take: limit,
      }),
    ])
    return { records, deletedUuids: deleted.map((r) => r.uuid).filter(Boolean) }
  },

  sync_logs: async (since, limit, offset) => {
    const where = buildWhere(since)
    const records = await prisma.syncLog.findMany({ where, skip: offset, take: limit, orderBy: { updatedAt: 'desc' } })
    return { records, deletedUuids: [] }
  },
}

// ==================== ALL MODELS ====================
const ALL_MODELS = Object.keys(modelQueries)

// ==================== LOGGER ====================
const logger = {
  sync: (action: string, data?: unknown) =>
    console.log(`[DB:SYNC] ${action}`, data ? JSON.stringify(data, null, 2) : ''),
  syncError: (action: string, error: unknown) =>
    console.error(`[DB:SYNC] [ERROR] ${action}`, error instanceof Error ? error.message : String(error)),
}

// ==================== ROUTE ====================
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const since = searchParams.get('since')
    const modelsParam = searchParams.get('models')
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 500)
    const offset = Number(searchParams.get('offset')) || 0

    const requestedModels = modelsParam
      ? modelsParam.split(',').map(m => m.trim()).filter(m => modelQueries[m])
      : ALL_MODELS

    logger.sync('[PULL] request', {
      since: since || 'all',
      models: requestedModels,
      limit,
      offset,
    })

    const response: PullResponse = {
      timestamp: new Date().toISOString(),
      models: {},
      hasMore: false,
    }

    for (const model of requestedModels) {
      try {
        const query = modelQueries[model]
        if (!query) continue

        const result = await query(since || undefined, limit, offset)
        response.models[model] = {
          records: result.records,
          deletedUuids: result.deletedUuids.filter((id): id is string => Boolean(id)),
        }

        if (result.records.length >= limit && result.records[0]?.updatedAt) {
          response.hasMore = true
          response.nextSince = result.records[result.records.length - 1].updatedAt
        }
      } catch (error) {
        logger.syncError(`[PULL] model_${model}`, error)
        response.models[model] = { records: [], deletedUuids: [] }
      }
    }

    logger.sync('[PULL] result', {
      modelsCount: Object.keys(response.models).length,
      hasMore: response.hasMore,
    })

    return NextResponse.json(response)
  } catch (error) {
    logger.syncError('[PULL] failed', error)
    return NextResponse.json(
      { error: 'Pull sync failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}





