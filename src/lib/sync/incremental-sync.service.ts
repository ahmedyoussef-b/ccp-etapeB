import { getDb, query, queryOne, run } from '@/lib/client-engine/sqlite';
import { initVectorStore, getVectorDB, vectorSyncHelpers } from '@/lib/client-engine/vector-store';
import { UnifiedTreeService } from '@/lib/db/services/unified-tree.service';
import { prisma } from '@/lib/prisma';

// ==================== TYPES ====================

export interface SyncReport {
  success: boolean;
  pulled: number;
  updated: number;
  conflicts: number;
  errors: string[];
  duration: number;
}

export interface VectorizationReport {
  success: boolean;
  documents: number;
  chunks: number;
  skipped: number;
  errors: string[];
  duration: number;
}

export interface FullSyncReport {
  success: boolean;
  webToLocal: SyncReport;
  localToVector: VectorizationReport;
  totalDuration: number;
}

// ==================== CONSTANTS ====================

const SYNC_METADATA_KEY = 'last_incremental_sync';
const VECTORIZATION_KEY = 'last_vectorization';

// ==================== LOGGER ====================

const logger = {
  sync: (action: string, data?: unknown) =>
    console.log(`[DB:INCREMENTAL-SYNC] ${action}`, data ? JSON.stringify(data, null, 2) : ''),
  syncError: (action: string, error: unknown) =>
    console.error(`[DB:INCREMENTAL-SYNC] [ERROR] ${action}`, error instanceof Error ? error.message : String(error)),
};

// ==================== SERVICE ====================

export class IncrementalSyncService {
  private static instance: IncrementalSyncService | null = null;

  static getInstance(): IncrementalSyncService {
    if (!IncrementalSyncService.instance) {
      IncrementalSyncService.instance = new IncrementalSyncService();
    }
    return IncrementalSyncService.instance;
  }

  // ==================== PUBLIC API ====================

  async syncWebToLocal(options?: { since?: Date; tables?: string[] }): Promise<SyncReport> {
    const startTime = Date.now();
    const report: SyncReport = {
      success: false,
      pulled: 0,
      updated: 0,
      conflicts: 0,
      errors: [],
      duration: 0,
    };

    try {
      const db = getDb();
      if (!db) {
        report.errors.push('SQLite not initialized');
        report.duration = Date.now() - startTime;
        return report;
      }

      const since = options?.since || await this.getLastSyncTimestamp();
      const tables = options?.tables || ['procedures', 'qa_pairs', 'media_items', 'tree_nodes', 'approvals'];

      for (const table of tables) {
        try {
          const tableReport = await this.syncTable(db, table, since);
          report.pulled += tableReport.pulled;
          report.updated += tableReport.updated;
          report.conflicts += tableReport.conflicts;
          report.errors.push(...tableReport.errors);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'unknown';
          report.errors.push(`${table}: ${msg}`);
        }
      }

      await this.setLastSyncTimestamp(new Date());
      report.success = report.errors.length === 0;
      report.duration = Date.now() - startTime;

      logger.sync('syncWebToLocal_completed', report);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'unknown';
      report.errors.push(msg);
      report.duration = Date.now() - startTime;
      logger.syncError('syncWebToLocal_failed', error);
    }

    return report;
  }

  async vectorizeLocalToVector(options?: { force?: boolean; batchSize?: number }): Promise<VectorizationReport> {
    const startTime = Date.now();
    const report: VectorizationReport = {
      success: false,
      documents: 0,
      chunks: 0,
      skipped: 0,
      errors: [],
      duration: 0,
    };

    try {
      const vectorDb = await initVectorStore();
      if (!vectorDb) {
        report.errors.push('Vector store not initialized');
        report.duration = Date.now() - startTime;
        return report;
      }

      const force = options?.force ?? false;
      const batchSize = options?.batchSize ?? 50;

      const lastVectorization = await this.getLastVectorizationTimestamp();
      const procedures = await UnifiedTreeService.loadWebTree();
      const qaPairs = await this.loadQAPairs(lastVectorization);
      const mediaItems = await this.loadMediaItems(lastVectorization);

      const allItems = [
        ...procedures.map(p => ({ type: 'procedure' as const, data: p })),
        ...qaPairs.map(q => ({ type: 'qa' as const, data: q })),
        ...mediaItems.map(m => ({ type: 'media' as const, data: m })),
      ];

      for (const item of allItems) {
        try {
          const result = await this.vectorizeItem(item, force, batchSize);
          if (result.vectorized) {
            report.documents++;
            report.chunks += result.chunks;
          } else {
            report.skipped++;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'unknown';
          report.errors.push(`${item.type}: ${msg}`);
        }
      }

      await this.setLastVectorizationTimestamp(new Date());
      report.success = report.errors.length === 0;
      report.duration = Date.now() - startTime;

      logger.sync('vectorizeLocalToVector_completed', report);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'unknown';
      report.errors.push(msg);
      report.duration = Date.now() - startTime;
      logger.syncError('vectorizeLocalToVector_failed', error);
    }

    return report;
  }

  async fullSync(options?: { since?: Date; forceVectorize?: boolean }): Promise<FullSyncReport> {
    logger.sync('fullSync_started', options);

    const webToLocal = await this.syncWebToLocal({ since: options?.since });
    const localToVector = await this.vectorizeLocalToVector({ force: options?.forceVectorize });

    const report: FullSyncReport = {
      success: webToLocal.success && localToVector.success,
      webToLocal,
      localToVector,
      totalDuration: webToLocal.duration + localToVector.duration,
    };

    logger.sync('fullSync_completed', report);
    return report;
  }

  // ==================== SYNC STATUS ====================

  async getSyncStats(): Promise<{
    totalWeb: number;
    totalLocal: number;
    synced: number;
    pending: number;
    localOnly: number;
    conflicts: number;
    lastSync: string | null;
    lastVectorization: string | null;
  }> {
    const [webTree, localTree] = await Promise.all([
      UnifiedTreeService.loadWebTree(),
      UnifiedTreeService.loadLocalTree(),
    ]);

    const merged = UnifiedTreeService.mergeTrees(webTree, localTree, []);
    const stats = UnifiedTreeService.getStats(merged);

    const instance = IncrementalSyncService.getInstance();
    const [lastSync, lastVectorization] = await Promise.all([
      instance.getLastSyncTimestamp(),
      instance.getLastVectorizationTimestamp(),
    ]);

    return {
      totalWeb: stats.bySource.web,
      totalLocal: stats.bySource.local,
      synced: stats.bySyncStatus.synced,
      pending: stats.bySyncStatus.pending,
      localOnly: stats.bySyncStatus['local-only'],
      conflicts: stats.bySyncStatus.conflict,
      lastSync: lastSync.toISOString(),
      lastVectorization: lastVectorization.toISOString(),
    };
  }

  // ==================== PRIVATE: SYNC HELPERS ====================

  private async syncTable(db: Awaited<ReturnType<typeof getDb>>, table: string, since: Date): Promise<{ pulled: number; updated: number; conflicts: number; errors: string[] }> {
    const result = { pulled: 0, updated: 0, conflicts: 0, errors: [] as string[] };

    try {
      const records = await this.fetchWebRecords(table, since);
      
      for (const record of records) {
        try {
          const existing = await this.findLocalRecord(db, table, record.uuid);
          if (existing) {
            await this.updateLocalRecord(db, table, record);
            result.updated++;
          } else {
            await this.insertLocalRecord(db, table, record);
            result.pulled++;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'unknown';
          result.errors.push(`${table} ${record.uuid}: ${msg}`);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'unknown';
      result.errors.push(`${table}: ${msg}`);
    }

    return result;
  }

  private async fetchWebRecords(table: string, since: Date): Promise<Array<{ uuid: string; [key: string]: unknown }>> {
    const { prisma } = await import('@/lib/prisma');
    const modelName = this.getModelName(table);
    
    if (!modelName) return [];

    const prismaModel = (prisma as unknown as Record<string, (arg: unknown) => Promise<unknown[]>>)[modelName];
    if (!prismaModel) return [];

    const baseArgs: Record<string, unknown> = {
      where: {
        updatedAt: { gt: since },
      },
    };

    if (table === 'media_items') {
      (baseArgs as Record<string, unknown>).select = {
        id: true,
        uuid: true,
        title: true,
        category: true,
        description: true,
        kind: true,
        mimeType: true,
        size: true,
        thumbnailDataUrl: true,
        geolocation: true,
        syncStatus: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      };
    }

    const records = await prismaModel(baseArgs);

    return records as Array<{ uuid: string; [key: string]: unknown }>;
  }

  private async findLocalRecord(db: Awaited<ReturnType<typeof getDb>>, table: string, uuid: string): Promise<Record<string, unknown> | null> {
    const rows = await query<Record<string, unknown>>(`SELECT * FROM "${table}" WHERE uuid = ? LIMIT 1`, [uuid]);
    return rows.length > 0 ? rows[0] : null;
  }

  private async insertLocalRecord(db: Awaited<ReturnType<typeof getDb>>, table: string, record: Record<string, unknown>): Promise<void> {
    const columns = Object.keys(record).filter(k => k !== 'id' && k !== 'createdAt' && k !== 'updatedAt');
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(c => record[c]);

    await run(`INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`, values);
  }

  private async updateLocalRecord(db: Awaited<ReturnType<typeof getDb>>, table: string, record: Record<string, unknown>): Promise<void> {
    const updates = Object.entries(record)
      .filter(([k]) => k !== 'id' && k !== 'uuid' && k !== 'createdAt' && k !== 'updatedAt')
      .map(([k, v]) => `"${k}" = ?`)
      .join(', ');
    
    const values = Object.entries(record)
      .filter(([k]) => k !== 'id' && k !== 'uuid' && k !== 'createdAt' && k !== 'updatedAt')
      .map(([, v]) => v);

    await run(`UPDATE "${table}" SET ${updates} WHERE uuid = ?`, [...values, record.uuid]);
  }

  // ==================== PRIVATE: VECTORIZATION HELPERS ====================

  private async loadQAPairs(since: Date): Promise<Array<{ id: string | number; question: string; answer: string }>> {
    const { prisma } = await import('@/lib/prisma');
    const pairs = await prisma.qAPair.findMany({
      where: { updatedAt: { gt: since } },
      select: { id: true, question: true, answer: true },
    });
    return pairs.map(p => ({ ...p, uuid: String(p.id) }));
  }

  private async loadMediaItems(since: Date): Promise<Array<{ id: string; title: string; description: string | null }>> {
    const { prisma } = await import('@/lib/prisma');
    const items = await prisma.mediaItem.findMany({
      where: { updatedAt: { gt: since } },
      select: { id: true, title: true, description: true },
    });
    return items.map(i => ({ ...i, uuid: i.id }));
  }

  private async vectorizeItem(item: { type: 'procedure' | 'qa' | 'media'; data: unknown }, force: boolean, batchSize: number): Promise<{ vectorized: boolean; chunks: number }> {
    const { addDocument } = await import('@/lib/client-engine/vector-store');
    const { simpleTokenEmbedding } = await import('@/lib/client-engine/vector-store');

    let docId: string;
    let content: string;
    let name: string;

    if (item.type === 'procedure') {
      const proc = item.data as { id: string; name: string; path: string; content?: string | null };
      docId = `procedure-${proc.id}`;
      name = proc.name;
      content = `${proc.name}\n${proc.content || ''}`;
    } else if (item.type === 'qa') {
      const qa = item.data as { id: string; question: string; answer: string };
      docId = `qa-${qa.id}`;
      name = qa.question;
      content = `Q: ${qa.question}\nR: ${qa.answer}`;
    } else {
      const media = item.data as { id: string; title: string; description: string | null };
      docId = `media-${media.id}`;
      name = media.title;
      content = `${media.title}\n${media.description || ''}`;
    }

    const chunks = this.createChunks(content, batchSize);
    const embeddings = chunks.map(c => simpleTokenEmbedding(c));

    await addDocument({
      id: docId,
      name,
      originalPath: docId,
      relativePath: docId,
      chunks: chunks.map((chunk, idx) => ({
        documentId: docId,
        documentName: name,
        chunkIndex: idx,
        content: chunk,
        embedding: embeddings[idx],
        metadata: { source: item.type },
      })),
      metadata: { source: item.type, vectorizedAt: new Date().toISOString() },
    });

    return { vectorized: true, chunks: chunks.length };
  }

  private createChunks(text: string, maxChunkSize: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    const chunkSize = Math.max(1, Math.floor(maxChunkSize / 10));

    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '));
    }

    return chunks.length > 0 ? chunks : [text];
  }

  // ==================== PRIVATE: METADATA HELPERS ====================

  private async getLastSyncTimestamp(): Promise<Date> {
    return this.getMetadata(SYNC_METADATA_KEY, new Date(0));
  }

  private async setLastSyncTimestamp(date: Date): Promise<void> {
    await this.setMetadata(SYNC_METADATA_KEY, date.toISOString());
  }

  private async getLastVectorizationTimestamp(): Promise<Date> {
    return this.getMetadata(VECTORIZATION_KEY, new Date(0));
  }

  private async setLastVectorizationTimestamp(date: Date): Promise<void> {
    await this.setMetadata(VECTORIZATION_KEY, date.toISOString());
  }

  private async getMetadata(key: string, defaultValue: Date): Promise<Date> {
    try {
      const db = getDb();
      if (!db) return defaultValue;
      const row = await queryOne<{ value: string }>(`SELECT value FROM sync_metadata WHERE key = ?`, [key]);
      if (!row) return defaultValue;
      const date = new Date(row.value);
      return isNaN(date.getTime()) ? defaultValue : date;
    } catch {
      return defaultValue;
    }
  }

  private async setMetadata(key: string, value: string): Promise<void> {
    const db = getDb();
    if (!db) return;
    await run(`INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, datetime('now'))`, [key, value]);
  }

  private getModelName(table: string): string | null {
    const map: Record<string, string> = {
      procedures: 'Procedure',
      qa_pairs: 'QAPair',
      media_items: 'MediaItem',
      local_tree: 'TreeNode',
      approvals: 'Approval',
    };
    return map[table] || null;
  }
}

// ==================== SINGLETON EXPORT ====================

export const incrementalSync = IncrementalSyncService.getInstance();
