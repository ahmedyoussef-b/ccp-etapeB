import { createHash } from 'crypto';
import { getDb } from '@/lib/client-engine/sqlite';
import { getDecompressedTechnicalData } from '@/lib/db/compression';
import type { Database } from '@sqlite.org/sqlite-wasm';
import {
  clearVectorStore,
  addDocument,
  searchByEmbedding,
  getStats,
  simpleTokenEmbedding,
  type VectorDocument,
  type VectorChunk,
} from '@/lib/client-engine/vector-store';
import { embedBatch } from '@/lib/llm/embedding-client';

const MIN_TEXT_LENGTH = 10;
const BATCH_SIZE = 100;
const CHUNK_WORD_SIZE = 50;
const SYNC_METADATA_KEY_CHECKSUM = 'vector_checksum';
const SYNC_METADATA_KEY_LAST_INDEXED = 'vector_last_indexed';

const logger = {
  reindex: (action: string, data?: unknown) =>
    console.log(`[VECTOR:REINDEX] ${action}`, data ? JSON.stringify(data, null, 2) : ''),
  reindexError: (action: string, error: unknown) =>
    console.error(`[VECTOR:REINDEX] [ERROR] ${action}`, error instanceof Error ? error.message : String(error)),
};

export interface ReindexMetrics {
  documentCount: number;
  chunkCount: number;
  duration: number;
  errors: string[];
  fallbackUsed: boolean;
}

export interface VectorSearchResult {
  content: string;
  score: number;
  documentId: string;
  documentName?: string;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

export interface VectorMetrics {
  documentCount: number;
  chunkCount: number;
  lastIndexed: number | null;
  vectorSize: number;
}

interface SourceRecord {
  id: string;
  name: string;
  content: string;
  source: 'qa_entries' | 'image_metadata' | 'technical_data';
  metadata?: Record<string, unknown>;
}

export class VectorReindexService {
  private static instance: VectorReindexService | null = null;
  private reindexing = false;

  static getInstance(): VectorReindexService {
    if (!VectorReindexService.instance) {
      VectorReindexService.instance = new VectorReindexService();
    }
    return VectorReindexService.instance;
  }

  async needsReindex(): Promise<boolean> {
    try {
      const db = getDb();
      if (!db) {
        logger.reindexError('needsReindex', 'SQLite not available');
        return false;
      }

      const currentChecksum = await this.computeDataChecksum(db);
      const storedChecksum = await this.getStoredChecksum();

      logger.reindex('needsReindex', { needsReindex: currentChecksum !== storedChecksum });
      return currentChecksum !== storedChecksum;
    } catch (error) {
      logger.reindexError('needsReindex', error);
      return false;
    }
  }

  async fullReindex(): Promise<ReindexMetrics> {
    const startTime = Date.now();
    const metrics: ReindexMetrics = {
      documentCount: 0,
      chunkCount: 0,
      duration: 0,
      errors: [],
      fallbackUsed: false,
    };

    if (this.reindexing) {
      logger.reindex('fullReindex_skipped', { reason: 'already_reindexing' });
      metrics.errors.push('Reindex already in progress');
      return metrics;
    }

    this.reindexing = true;

    try {
      logger.reindex('fullReindex_started', {});

      await clearVectorStore();

      const records = await this.fetchSourceRecords();
      logger.reindex('fullReindex_source_records', { count: records.length });

      if (records.length === 0) {
        await this.updateChecksumAndTimestamp();
        metrics.duration = Date.now() - startTime;
        logger.reindex('fullReindex_complete_no_data', metrics);
        return metrics;
      }

      const chunks = this.chunkRecords(records);
      logger.reindex('fullReindex_chunks', { count: chunks.length });

      const { documentCount, chunkCount, fallbackUsed } = await this.embedAndStore(chunks);
      metrics.documentCount = documentCount;
      metrics.chunkCount = chunkCount;
      metrics.fallbackUsed = fallbackUsed;

      await this.updateChecksumAndTimestamp();

      metrics.duration = Date.now() - startTime;
      logger.reindex('fullReindex_complete', metrics);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'unknown';
      metrics.errors.push(msg);
      metrics.duration = Date.now() - startTime;
      logger.reindexError('fullReindex_failed', error);
    } finally {
      this.reindexing = false;
    }

    return metrics;
  }

  async search(query: string, limit = 10): Promise<VectorSearchResult[]> {
    try {
      const queryEmbedding = simpleTokenEmbedding(query);
      const results = await searchByEmbedding(queryEmbedding, limit);

      return results.map(r => ({
        content: r.content,
        score: r.score,
        documentId: r.documentId,
        documentName: r.documentName,
        chunkIndex: r.chunkIndex,
        metadata: r.metadata,
      }));
    } catch (error) {
      logger.reindexError('search', error);
      return [];
    }
  }

  async getMetrics(): Promise<VectorMetrics> {
    try {
      const stats = await getStats();
      const lastIndexed = await this.getLastIndexedTimestamp();

      const sampleChunk = await this.getSampleEmbeddingSize();
      const vectorSize = sampleChunk || 384;

      return {
        documentCount: stats.documentCount,
        chunkCount: stats.chunkCount,
        lastIndexed,
        vectorSize,
      };
    } catch (error) {
      logger.reindexError('getMetrics', error);
      return { documentCount: 0, chunkCount: 0, lastIndexed: null, vectorSize: 384 };
    }
  }

  // ==================== SOURCE DATA ====================

  private async fetchSourceRecords(): Promise<SourceRecord[]> {
    const db = getDb();
    if (!db) throw new Error('SQLite not initialized');

    const records: SourceRecord[] = [];

    try {
      const qaRows = await this.queryTable<{
        id: number;
        question: string;
        answer: string;
        tags: string | null;
      }>(db, 'qa_entries', 'SELECT id, question, answer, tags FROM qa_entries');

      for (const row of qaRows) {
        const content = `${row.question} ${row.answer}`.trim();
        if (content.length >= MIN_TEXT_LENGTH) {
          records.push({
            id: `qa-${row.id}`,
            name: `QA #${row.id}`,
            content,
            source: 'qa_entries',
            metadata: row.tags ? { tags: row.tags } : undefined,
          });
        }
      }
    } catch (error) {
      logger.reindexError('fetch_qa_entries', error);
    }

    try {
      const imageRows = await this.queryTable<{
        id: number;
        title: string | null;
        description: string | null;
        category: string | null;
      }>(db, 'image_metadata', 'SELECT id, title, description, category FROM image_metadata');

      for (const row of imageRows) {
        const content = [row.title, row.description].filter(Boolean).join(' ').trim();
        if (content.length >= MIN_TEXT_LENGTH) {
          records.push({
            id: `img-${row.id}`,
            name: row.title || `Image #${row.id}`,
            content,
            source: 'image_metadata',
            metadata: row.category ? { category: row.category } : undefined,
          });
        }
      }
    } catch (error) {
      logger.reindexError('fetch_image_metadata', error);
    }

    try {
      const techRows = await this.queryTable<{
        id: number;
        title: string | null;
        data_type: string;
        tags: string | null;
      }>(db, 'technical_data', 'SELECT id, title, data_type, tags FROM technical_data');

      for (const row of techRows) {
        const bodyBuffer = getDecompressedTechnicalData(db, row.id);
        const bodyText = bodyBuffer ? bodyBuffer.toString('utf-8') : '';
        const content = [row.title, bodyText].filter(Boolean).join(' ').trim();

        if (content.length >= MIN_TEXT_LENGTH) {
          records.push({
            id: `tech-${row.id}`,
            name: row.title || `Tech #${row.id}`,
            content,
            source: 'technical_data',
            metadata: {
              dataType: row.data_type,
              ...(row.tags ? { tags: row.tags } : {}),
            },
          });
        }
      }
    } catch (error) {
      logger.reindexError('fetch_technical_data', error);
    }

    return records;
  }

  // ==================== CHUNKING ====================

  private chunkRecords(records: SourceRecord[]): Array<{
    docId: string;
    docName: string;
    content: string;
    chunkIndex: number;
    source: string;
    metadata?: Record<string, unknown>;
  }> {
    const chunks: Array<{
      docId: string;
      docName: string;
      content: string;
      chunkIndex: number;
      source: string;
      metadata?: Record<string, unknown>;
    }> = [];

    for (const record of records) {
      const textChunks = this.createChunks(record.content, CHUNK_WORD_SIZE);

      for (let i = 0; i < textChunks.length; i++) {
        chunks.push({
          docId: record.id,
          docName: record.name,
          content: textChunks[i],
          chunkIndex: i,
          source: record.source,
          metadata: record.metadata,
        });
      }
    }

    return chunks;
  }

  private createChunks(text: string, chunkWordSize: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= chunkWordSize) return [text];

    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += chunkWordSize) {
      chunks.push(words.slice(i, i + chunkWordSize).join(' '));
    }
    return chunks;
  }

  // ==================== EMBEDDING & STORAGE ====================

  private async embedAndStore(chunks: Array<{
    docId: string;
    docName: string;
    content: string;
    chunkIndex: number;
    source: string;
    metadata?: Record<string, unknown>;
  }>): Promise<{ documentCount: number; chunkCount: number; fallbackUsed: boolean }> {
    let fallbackUsed = false;
    const documentMap = new Map<string, { name: string; source: string; metadata?: Record<string, unknown> }>();

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map(c => c.content);

      let embeddings: number[][];
      try {
        embeddings = await embedBatch(texts);
        if (embeddings.length > 0 && embeddings[0].length === 384) {
          fallbackUsed = true;
        }
      } catch (error) {
        logger.reindexError('embed_batch_failed', error);
        fallbackUsed = true;
        embeddings = texts.map(t => simpleTokenEmbedding(t));
      }

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = embeddings[j] || simpleTokenEmbedding(chunk.content);

        if (!documentMap.has(chunk.docId)) {
          documentMap.set(chunk.docId, {
            name: chunk.docName,
            source: chunk.source,
            metadata: chunk.metadata,
          });
        }

        const vectorChunk: VectorChunk = {
          documentId: chunk.docId,
          documentName: chunk.docName,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          embedding,
          metadata: { source: chunk.source, ...chunk.metadata },
          createdAt: Date.now(),
          syncStatus: 'synced',
        };

        await this.addChunk(vectorChunk);
      }

      logger.reindex('embed_batch_progress', {
        processed: Math.min(i + BATCH_SIZE, chunks.length),
        total: chunks.length,
      });
    }

    let documentCount = 0;
    for (const [docId, docInfo] of documentMap) {
      const doc: VectorDocument = {
        id: docId,
        name: docInfo.name,
        originalPath: docId,
        relativePath: docId,
        chunks: [],
        metadata: { source: docInfo.source, ...docInfo.metadata },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        syncStatus: 'synced',
      };
      await addDocument(doc);
      documentCount++;
    }

    return { documentCount, chunkCount: chunks.length, fallbackUsed };
  }

  private async addChunk(chunk: VectorChunk): Promise<void> {
    const { getVectorDB } = await import('@/lib/client-engine/vector-store');
    const db = getVectorDB();
    if (!db) throw new Error('VectorStore not initialized');
    await db.chunks.add(chunk);
  }

  // ==================== CHECKSUM ====================

  private async computeDataChecksum(db: Database | null): Promise<string> {
    if (!db) return '';

    const tables = ['qa_entries', 'image_metadata', 'technical_data'];
    const counts: Record<string, number> = {};

    for (const table of tables) {
      try {
        const stmt = db.prepare(`SELECT COUNT(*) as count FROM ${table}`);
        stmt.step();
        const row = stmt.get({}) as { count: number };
        stmt.finalize();
        counts[table] = row.count;
      } catch {
        counts[table] = 0;
      }
    }

    const hash = createHash('sha256');
    hash.update(JSON.stringify(counts));

    try {
      const stmt = db.prepare(`SELECT MAX(updated_at) as max_updated FROM (
        SELECT MAX(updated_at) as updated_at FROM qa_entries
        UNION ALL
        SELECT MAX(updated_at) as updated_at FROM image_metadata
        UNION ALL
        SELECT MAX(updated_at) as updated_at FROM technical_data
      )`);
      stmt.step();
      const row = stmt.get({}) as { max_updated: number | string | null };
      stmt.finalize();
      if (row.max_updated) {
        hash.update(String(row.max_updated));
      }
    } catch {
      // ignore
    }

    return hash.digest('hex');
  }

  private async getStoredChecksum(): Promise<string | null> {
    try {
      const db = getDb();
      if (!db) return null;
      const stmt = db.prepare('SELECT value FROM sync_metadata WHERE key = ? LIMIT 1');
      stmt.bind([SYNC_METADATA_KEY_CHECKSUM]);
      if (!stmt.step()) {
        stmt.finalize();
        return null;
      }
      const row = stmt.get({}) as { value: string };
      stmt.finalize();
      return row.value;
    } catch {
      return null;
    }
  }

  private async updateChecksumAndTimestamp(): Promise<void> {
    try {
      const db = getDb();
      if (!db) return;

      const checksum = await this.computeDataChecksum(db);
      const now = Date.now();

      const stmt = db.prepare(
        "INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, datetime('now'))"
      );

      stmt.bind([SYNC_METADATA_KEY_CHECKSUM, checksum]);
      stmt.step();
      stmt.finalize();

      const stmt2 = db.prepare(
        "INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, datetime('now'))"
      );
      stmt2.bind([SYNC_METADATA_KEY_LAST_INDEXED, String(now)]);
      stmt2.step();
      stmt2.finalize();
    } catch (error) {
      logger.reindexError('update_checksum', error);
    }
  }

  private async getLastIndexedTimestamp(): Promise<number | null> {
    try {
      const db = getDb();
      if (!db) return null;
      const stmt = db.prepare('SELECT value FROM sync_metadata WHERE key = ? LIMIT 1');
      stmt.bind([SYNC_METADATA_KEY_LAST_INDEXED]);
      if (!stmt.step()) {
        stmt.finalize();
        return null;
      }
      const row = stmt.get({}) as { value: string };
      stmt.finalize();
      const ts = parseInt(row.value, 10);
      return isNaN(ts) ? null : ts;
    } catch {
      return null;
    }
  }

  private async getSampleEmbeddingSize(): Promise<number> {
    try {
      const { getVectorDB } = await import('@/lib/client-engine/vector-store');
      const db = getVectorDB();
      if (!db) return 384;
      const chunk = await db.chunks.limit(1).first();
      return chunk?.embedding?.length || 384;
    } catch {
      return 384;
    }
  }

  // ==================== SQLITE HELPERS ====================

  private async queryTable<T>(db: Database, _table: string, sql: string): Promise<T[]> {
    const stmt = db.prepare(sql);
    try {
      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.get({}) as T);
      }
      return results;
    } finally {
      stmt.finalize();
    }
  }
}

export const vectorReindexService = VectorReindexService.getInstance();
