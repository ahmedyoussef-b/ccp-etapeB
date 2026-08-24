import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateUUID } from '@/lib/prisma'

// ==================== TYPES ====================
interface PushPayload {
  model: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  records: any[]
  deletedUuids: string[]
}

interface PushResult {
  accepted: number
  conflicts: string[]
  errors: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModelHandler = (records: any[], deletedUuids: string[]) => Promise<PushResult>

// ==================== MODEL NAME MAPPING ====================
const MODEL_MAP: Record<string, string> = {
  procedures: 'Procedure',
  procedure_required_roles: 'ProcedureRequiredRole',
  procedure_safety_instructions: 'ProcedureSafetyInstruction',
  procedure_tags: 'ProcedureTag',
  procedure_versions: 'ProcedureVersion',
  approvals: 'Approval',
  tree_nodes: 'TreeNode',
  qa_registries: 'QARegistry',
  qa_pairs: 'QAPair',
  media_items: 'MediaItem',
  media_item_tags: 'MediaItemTag',
  iot_sensor_states: 'IotSensorState',
  iot_actuator_states: 'IotActuatorState',
  sync_logs: 'SyncLog',
}

// ==================== LOGGER ====================
const logger = {
  sync: (action: string, data?: unknown) =>
    console.log(`[DB:SYNC] ${action}`, data ? JSON.stringify(data, null, 2) : ''),
  syncError: (action: string, error: unknown) =>
    console.error(`[DB:SYNC] [ERROR] ${action}`, error instanceof Error ? error.message : String(error)),
}

// ==================== HELPERS ====================
async function logSync(
  modelName: string,
  operation: string,
  recordUuid: string | undefined,
  status: string,
  error?: string
): Promise<void> {
  try {
    await prisma.syncLog.create({
      data: {
        uuid: generateUUID(),
        modelName,
        recordUuid,
        operation,
        status,
        error,
        source: 'client',
        target: 'server',
        syncedAt: new Date(),
      },
    })
  } catch {
    // ignore logging errors
  }
}

function extractUuid(record: Record<string, unknown>): string | undefined {
  return (record?.uuid as string | undefined) || (record?.id as string | undefined)
}

// ==================== HANDLERS ====================
const handlers: Record<string, ModelHandler> = {
  procedures: async (records, deletedUuids) => {
    let accepted = 0
    const conflicts: string[] = []
    const errors: string[] = []

    for (const record of records) {
      try {
        const uuid = extractUuid(record)
        if (!uuid) {
          errors.push('Missing uuid in procedure record')
          continue
        }

        const { requiredRoles, globalSafetyInstructions, tags, ...procedureData } = record

        await prisma.procedure.upsert({
          where: { uuid },
          create: {
            uuid,
            code: procedureData.code || generateUUID(),
            title: procedureData.title || 'Sans titre',
            description: procedureData.description || '',
            category: procedureData.category || 'general',
            priority: procedureData.priority || 'moyenne',
            estimatedTimeMinutes: procedureData.estimatedTimeMinutes || 1,
            body: procedureData.body || {},
            version: procedureData.version || '1.0',
            language: procedureData.language || 'fr-FR',
            status: procedureData.status || 'draft',
            authorId: procedureData.authorId,
            authorName: procedureData.authorName,
            approverId: procedureData.approverId,
            approverName: procedureData.approverName,
            reviewDate: procedureData.reviewDate ? new Date(procedureData.reviewDate) : undefined,
            requiredRoles: requiredRoles?.length ? {
              create: requiredRoles.map((r: Record<string, unknown>) => ({ uuid: (r.uuid as string) || generateUUID(), role: (r.role as string) }))
            } : undefined,
            globalSafetyInstructions: globalSafetyInstructions?.length ? {
              create: globalSafetyInstructions.map((s: Record<string, unknown>) => ({ uuid: (s.uuid as string) || generateUUID(), instruction: (s.instruction as string) }))
            } : undefined,
            tags: tags?.length ? {
              create: tags.map((t: Record<string, unknown>) => ({ uuid: (t.uuid as string) || generateUUID(), tag: (t.tag as string) }))
            } : undefined,
          },
          update: {
            title: procedureData.title,
            description: procedureData.description,
            category: procedureData.category,
            priority: procedureData.priority,
            estimatedTimeMinutes: procedureData.estimatedTimeMinutes,
            body: procedureData.body,
            version: procedureData.version,
            language: procedureData.language,
            status: procedureData.status,
            authorId: procedureData.authorId,
            authorName: procedureData.authorName,
            approverId: procedureData.approverId,
            approverName: procedureData.approverName,
            reviewDate: procedureData.reviewDate ? new Date(procedureData.reviewDate) : undefined,
          },
        })

        accepted++
        await logSync('procedures', 'push', uuid, 'synced')
      } catch (error) {
        const uuid = extractUuid(record)
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(errorMsg)
        await logSync('procedures', 'push', uuid, 'error', errorMsg)
      }
    }

    for (const uuid of deletedUuids) {
      try {
        await prisma.procedure.update({
          where: { uuid },
          data: { deletedAt: new Date(), syncStatus: 'pending' },
        })
        await logSync('procedures', 'delete', uuid, 'synced')
        accepted++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(errorMsg)
        await logSync('procedures', 'delete', uuid, 'error', errorMsg)
      }
    }

    return { accepted, conflicts, errors }
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  procedure_required_roles: async (records, _deletedUuids) => {
    let accepted = 0
    const conflicts: string[] = []
    const errors: string[] = []

    for (const record of records) {
      try {
        const uuid = record?.uuid
        if (!uuid) {
          errors.push('Missing uuid in procedure_required_roles record')
          continue
        }

        await prisma.procedureRequiredRole.upsert({
          where: { uuid },
          create: {
            uuid,
            procedureId: record.procedureId || 0,
            role: record.role || '',
          },
          update: {
            procedureId: record.procedureId,
            role: record.role,
          },
        })

        accepted++
        await logSync('procedure_required_roles', 'push', uuid, 'synced')
      } catch (error) {
        const uuid = record?.uuid
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(errorMsg)
        await logSync('procedure_required_roles', 'push', uuid, 'error', errorMsg)
      }
    }

    return { accepted, conflicts, errors }
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  procedure_safety_instructions: async (records, _deletedUuids) => {
    let accepted = 0
    const conflicts: string[] = []
    const errors: string[] = []

    for (const record of records) {
      try {
        const uuid = record?.uuid
        if (!uuid) {
          errors.push('Missing uuid in procedure_safety_instructions record')
          continue
        }

        await prisma.procedureSafetyInstruction.upsert({
          where: { uuid },
          create: {
            uuid,
            procedureId: record.procedureId || 0,
            instruction: record.instruction || '',
          },
          update: {
            procedureId: record.procedureId,
            instruction: record.instruction,
          },
        })

        accepted++
        await logSync('procedure_safety_instructions', 'push', uuid, 'synced')
      } catch (error) {
        const uuid = record?.uuid
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(errorMsg)
        await logSync('procedure_safety_instructions', 'push', uuid, 'error', errorMsg)
      }
    }

    return { accepted, conflicts, errors }
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  procedure_tags: async (records, _deletedUuids) => {
    let accepted = 0
    const conflicts: string[] = []
    const errors: string[] = []

    for (const record of records) {
      try {
        const uuid = record?.uuid
        if (!uuid) {
          errors.push('Missing uuid in procedure_tags record')
          continue
        }

        await prisma.procedureTag.upsert({
          where: { uuid },
          create: {
            uuid,
            procedureId: record.procedureId || 0,
            tag: record.tag || '',
          },
          update: {
            procedureId: record.procedureId,
            tag: record.tag,
          },
        })

        accepted++
        await logSync('procedure_tags', 'push', uuid, 'synced')
      } catch (error) {
        const uuid = record?.uuid
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(errorMsg)
        await logSync('procedure_tags', 'push', uuid, 'error', errorMsg)
      }
    }

    return { accepted, conflicts, errors }
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  procedure_versions: async (records, _deletedUuids) => {
    let accepted = 0
    const conflicts: string[] = []
    const errors: string[] = []

    for (const record of records) {
      try {
        const uuid = record?.uuid
        if (!uuid) {
          errors.push('Missing uuid in procedure_versions record')
          continue
        }

        await prisma.procedureVersion.upsert({
          where: { uuid },
          create: {
            uuid,
            procedureCode: record.procedureCode || '',
            version: record.version || '1.0',
            body: record.body || {},
            createdBy: record.createdBy,
            createdByName: record.createdByName,
            comment: record.comment,
          },
          update: {
            procedureCode: record.procedureCode,
            version: record.version,
            body: record.body,
            createdBy: record.createdBy,
            createdByName: record.createdByName,
            comment: record.comment,
          },
        })

        accepted++
        await logSync('procedure_versions', 'push', uuid, 'synced')
      } catch (error) {
        const uuid = record?.uuid
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(errorMsg)
        await logSync('procedure_versions', 'push', uuid, 'error', errorMsg)
      }
    }

    return { accepted, conflicts, errors }
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  approvals: async (records, _deletedUuids) => {
    let accepted = 0
    const conflicts: string[] = []
    const errors: string[] = []

    for (const record of records) {
      try {
        const uuid = record?.uuid
        if (!uuid) {
          errors.push('Missing uuid in approvals record')
          continue
        }

        await prisma.approval.upsert({
          where: { uuid },
          create: {
            uuid,
            procedureId: record.procedureId || 0,
            approverId: record.approverId || '',
            approverName: record.approverName,
            approverRole: record.approverRole,
            status: record.status || 'pending',
            comment: record.comment,
          },
          update: {
            procedureId: record.procedureId,
            approverId: record.approverId,
            approverName: record.approverName,
            approverRole: record.approverRole,
            status: record.status,
            comment: record.comment,
          },
        })

        accepted++
        await logSync('approvals', 'push', uuid, 'synced')
      } catch (error) {
        const uuid = record?.uuid
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(errorMsg)
        await logSync('approvals', 'push', uuid, 'error', errorMsg)
      }
    }

    return { accepted, conflicts, errors }
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tree_nodes: async (records, _deletedUuids) => {
    let accepted = 0
    const conflicts: string[] = []
    const errors: string[] = []

    for (const record of records) {
      try {
        const uuid = record?.uuid
        if (!uuid) {
          errors.push('Missing uuid in tree_nodes record')
          continue
        }

        await prisma.treeNode.upsert({
          where: { uuid },
          create: {
            uuid,
            name: record.name || 'Sans nom',
            type: record.type || 'file',
            metadata: record.metadata,
            parentId: record.parentId || null,
            order: record.order || 0,
          },
          update: {
            name: record.name,
            type: record.type,
            metadata: record.metadata,
            parentId: record.parentId,
            order: record.order,
          },
        })

        accepted++
        await logSync('tree_nodes', 'push', uuid, 'synced')
      } catch (error) {
        const uuid = record?.uuid
        const errorMsg = error instanceof Error ? error.message : String(error)
        conflicts.push(uuid || 'unknown')
        errors.push(errorMsg)
        await logSync('tree_nodes', 'push', uuid, 'error', errorMsg)
      }
    }

    return { accepted, conflicts, errors }
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  qa_registries: async (records, _deletedUuids) => {
    let accepted = 0
    const conflicts: string[] = []
    const errors: string[] = []

    for (const record of records) {
      try {
        const uuid = record?.uuid
        if (!uuid) {
          errors.push('Missing uuid in qa_registries record')
          continue
        }

        await prisma.qARegistry.upsert({
          where: { uuid },
          create: {
            uuid,
            title: record.title || 'Sans titre',
            description: record.description,
          },
          update: {
            title: record.title,
            description: record.description,
          },
        })

        accepted++
        await logSync('qa_registries', 'push', uuid, 'synced')
      } catch (error) {
        const uuid = record?.uuid
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(errorMsg)
        await logSync('qa_registries', 'push', uuid, 'error', errorMsg)
      }
    }

    return { accepted, conflicts, errors }
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  qa_pairs: async (records, _deletedUuids) => {
    let accepted = 0
    const conflicts: string[] = []
    const errors: string[] = []

    for (const record of records) {
      try {
        const uuid = record?.uuid
        if (!uuid) {
          errors.push('Missing uuid in qa_pairs record')
          continue
        }

        await prisma.qAPair.upsert({
          where: { uuid },
          create: {
            uuid,
            question: record.question || '',
            answer: record.answer || '',
            order: record.order || 0,
            registryId: record.registryId || 0,
          },
          update: {
            question: record.question,
            answer: record.answer,
            order: record.order,
            registryId: record.registryId,
          },
        })

        accepted++
        await logSync('qa_pairs', 'push', uuid, 'synced')
      } catch (error) {
        const uuid = record?.uuid
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(errorMsg)
        await logSync('qa_pairs', 'push', uuid, 'error', errorMsg)
      }
    }

    return { accepted, conflicts, errors }
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  media_items: async (records, _deletedUuids) => {
    let accepted = 0
    const conflicts: string[] = []
    const errors: string[] = []

    for (const record of records) {
      try {
        const uuid = record?.uuid
        if (!uuid) {
          errors.push('Missing uuid in media_items record')
          continue
        }

        const { tags, ...mediaData } = record

        await prisma.mediaItem.upsert({
          where: { uuid },
          create: {
            uuid,
            title: mediaData.title || 'Sans titre',
            category: mediaData.category || 'general',
            description: mediaData.description,
            kind: mediaData.kind || 'image',
            mimeType: mediaData.mimeType || 'image/jpeg',
            size: mediaData.size || 0,
            dataUrl: mediaData.dataUrl || '',
            thumbnailDataUrl: mediaData.thumbnailDataUrl,
            geolocation: mediaData.geolocation,
            tags: tags?.length ? {
              create: tags.map((t: Record<string, unknown>) => ({ uuid: (t.uuid as string) || generateUUID(), tag: (t.tag as string) }))
            } : undefined,
          },
          update: {
            title: mediaData.title,
            category: mediaData.category,
            description: mediaData.description,
            kind: mediaData.kind,
            mimeType: mediaData.mimeType,
            size: mediaData.size,
            dataUrl: mediaData.dataUrl,
            thumbnailDataUrl: mediaData.thumbnailDataUrl,
            geolocation: mediaData.geolocation,
          },
        })

        accepted++
        await logSync('media_items', 'push', uuid, 'synced')
      } catch (error) {
        const uuid = record?.uuid
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(errorMsg)
        await logSync('media_items', 'push', uuid, 'error', errorMsg)
      }
    }

    return { accepted, conflicts, errors }
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  media_item_tags: async (records, _deletedUuids) => {
    let accepted = 0
    const conflicts: string[] = []
    const errors: string[] = []

    for (const record of records) {
      try {
        const uuid = record?.uuid
        if (!uuid) {
          errors.push('Missing uuid in media_item_tags record')
          continue
        }

        await prisma.mediaItemTag.upsert({
          where: { uuid },
          create: {
            uuid,
            mediaItemId: record.mediaItemId || '',
            tag: record.tag || '',
          },
          update: {
            mediaItemId: record.mediaItemId,
            tag: record.tag,
          },
        })

        accepted++
        await logSync('media_item_tags', 'push', uuid, 'synced')
      } catch (error) {
        const uuid = record?.uuid
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(errorMsg)
        await logSync('media_item_tags', 'push', uuid, 'error', errorMsg)
      }
    }

    return { accepted, conflicts, errors }
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  iot_sensor_states: async (records, _deletedUuids) => {
    let accepted = 0
    const conflicts: string[] = []
    const errors: string[] = []

    for (const record of records) {
      try {
        const id = record?.id
        if (!id) {
          errors.push('Missing id in iot_sensor_states record')
          continue
        }

        await prisma.iotSensorState.upsert({
          where: { id },
          create: {
            id,
            uuid: record.uuid || generateUUID(),
            name: record.name || '',
            type: record.type || '',
            value: Number(record.value) || 0,
            unit: record.unit || '',
            threshold: Number(record.threshold) || 0,
          },
          update: {
            name: record.name,
            type: record.type,
            value: Number(record.value),
            unit: record.unit,
            threshold: Number(record.threshold),
          },
        })

        accepted++
        await logSync('iot_sensor_states', 'push', record.uuid, 'synced')
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(errorMsg)
        await logSync('iot_sensor_states', 'push', record?.uuid, 'error', errorMsg)
      }
    }

    return { accepted, conflicts, errors }
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  iot_actuator_states: async (records, _deletedUuids) => {
    let accepted = 0
    const conflicts: string[] = []
    const errors: string[] = []

    for (const record of records) {
      try {
        const id = record?.id
        if (!id) {
          errors.push('Missing id in iot_actuator_states record')
          continue
        }

        await prisma.iotActuatorState.upsert({
          where: { id },
          create: {
            id,
            uuid: record.uuid || generateUUID(),
            name: record.name || '',
            type: record.type || '',
            isOn: record.isOn ?? false,
            position: record.position ?? null,
          },
          update: {
            name: record.name,
            type: record.type,
            isOn: record.isOn ?? false,
            position: record.position ?? null,
          },
        })

        accepted++
        await logSync('iot_actuator_states', 'push', record.uuid, 'synced')
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(errorMsg)
        await logSync('iot_actuator_states', 'push', record?.uuid, 'error', errorMsg)
      }
    }

    return { accepted, conflicts, errors }
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sync_logs: async (records, _deletedUuids) => {
    let accepted = 0
    const conflicts: string[] = []
    const errors: string[] = []

    for (const record of records) {
      try {
        const uuid = record?.uuid
        if (!uuid) {
          errors.push('Missing uuid in sync_logs record')
          continue
        }

        await prisma.syncLog.upsert({
          where: { uuid },
          create: {
            uuid,
            modelName: record.modelName || 'unknown',
            recordId: record.recordId,
            recordUuid: record.recordUuid,
            operation: record.operation || 'push',
            status: record.status || 'synced',
            source: record.source,
            target: record.target,
            error: record.error,
            metadata: record.metadata,
            syncedAt: record.syncedAt ? new Date(record.syncedAt) : new Date(),
          },
          update: {
            modelName: record.modelName,
            recordId: record.recordId,
            recordUuid: record.recordUuid,
            operation: record.operation,
            status: record.status,
            source: record.source,
            target: record.target,
            error: record.error,
            metadata: record.metadata,
            syncedAt: record.syncedAt ? new Date(record.syncedAt) : new Date(),
          },
        })

        accepted++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(errorMsg)
      }
    }

    return { accepted, conflicts, errors }
  },
}

// ==================== ROUTE ====================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { model, records, deletedUuids } = body as PushPayload

    logger.sync('[PUSH] request', {
      model,
      recordsCount: records?.length || 0,
      deletedCount: deletedUuids?.length || 0,
    })

    if (!model || typeof model !== 'string') {
      return NextResponse.json({ accepted: 0, conflicts: [], errors: ['Missing or invalid model name'] }, { status: 400 })
    }

    if (!records || !Array.isArray(records)) {
      return NextResponse.json({ accepted: 0, conflicts: [], errors: ['Missing or invalid records array'] }, { status: 400 })
    }

    const prismaModel = MODEL_MAP[model]
    if (!prismaModel) {
      return NextResponse.json({
        accepted: 0,
        conflicts: [],
        errors: [`Unsupported model: ${model}. Supported models: ${Object.keys(MODEL_MAP).join(', ')}`],
      }, { status: 400 })
    }

    const handler = handlers[model]
    if (!handler) {
      return NextResponse.json({
        accepted: 0,
        conflicts: [],
        errors: [`No handler implemented for model: ${model}`],
      }, { status: 501 })
    }

    const result: PushResult = await handler(records, deletedUuids || [])

    logger.sync('[PUSH] result', {
      model,
      accepted: result.accepted,
      conflicts: result.conflicts.length,
      errors: result.errors.length,
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.syncError('[PUSH] failed', error)
    return NextResponse.json({
      accepted: 0,
      conflicts: [],
      errors: [error instanceof Error ? error.message : 'Sync failed'],
    }, { status: 500 })
  }
}


