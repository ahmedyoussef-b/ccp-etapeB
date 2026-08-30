import { NextRequest, NextResponse } from 'next/server'
import { pgToSqliteSync } from '@/lib/sync/pg-to-sqlite-sync.service'
import { vectorReindexService } from '@/lib/sync/vector-reindex.service'

const logger = {
  sync: (action: string, data?: unknown) =>
    console.log(`[API:SYNC] ${action}`, data ? JSON.stringify(data, null, 2) : ''),
  syncError: (action: string, error: unknown) =>
    console.error(`[API:SYNC] [ERROR] ${action}`, error instanceof Error ? error.message : String(error)),
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface SyncResponse {
  success: boolean
  inserted: number
  updated: number
  deleted: number
  errors: string[]
  duration: number
  checksumValid: boolean
  vectorReindex?: {
    performed: boolean
    documentCount: number
    chunkCount: number
    reindexDuration: number
    errors: string[]
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const since = body.since ? new Date(body.since) : undefined

    logger.sync('[API] sync_request', { since: since?.toISOString() })

    const report = await pgToSqliteSync.sync({ since })

    const response: SyncResponse = {
      success: report.success,
      inserted: report.inserted,
      updated: report.updated,
      deleted: report.deleted,
      errors: report.errors,
      duration: report.duration,
      checksumValid: report.checksumValid,
    }

    logger.sync('[API] sync_response', response)

    if (report.success) {
      try {
        logger.sync('[API] vector_reindex_start', {})
        const reindexMetrics = await vectorReindexService.fullReindex();
        response.vectorReindex = {
          performed: true,
          documentCount: reindexMetrics.documentCount,
          chunkCount: reindexMetrics.chunkCount,
          reindexDuration: reindexMetrics.duration,
          errors: reindexMetrics.errors,
        };
        logger.sync('[API] vector_reindex_complete', response.vectorReindex);
      } catch (reindexError) {
        const msg = reindexError instanceof Error ? reindexError.message : String(reindexError);
        response.vectorReindex = {
          performed: false,
          documentCount: 0,
          chunkCount: 0,
          reindexDuration: 0,
          errors: [msg],
        };
        logger.syncError('[API] vector_reindex_failed', reindexError);
      }
    }

    if (!report.success) {
      return NextResponse.json(response, { status: 500 })
    }

    return NextResponse.json(response)
  } catch (error) {
    logger.syncError('[API] sync_failed', error)

    const normalized = (error instanceof Error ? error.message : String(error)).toLowerCase();
    const isDbUnavailable =
      normalized.includes("can't reach database server") ||
      normalized.includes('connection') ||
      normalized.includes('timeout');

    if (isDbUnavailable) {
      return NextResponse.json(
        { error: 'database_unavailable', details: 'PostgreSQL is unreachable' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'sync_failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
