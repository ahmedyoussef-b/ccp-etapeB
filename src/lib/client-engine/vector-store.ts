import Dexie, { type Table } from 'dexie';
const logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  indexeddb: (action: string, data?: any) =>
    console.log(`[DB:INDEXEDDB] ${action}`, data ? JSON.stringify(data, null, 2) : ''),
  indexeddbError: (action: string, error: unknown) =>
    console.error(`[DB:INDEXEDDB] [ERROR] ${action}`, error)
};

export interface VectorChunk { id?: number; documentId: string; documentName?: string; chunkIndex: number; content: string; embedding: number[]; metadata?: Record<string, unknown>; createdAt: number; syncStatus?: string; }
export interface VectorDocument { id: string; name: string; originalPath: string; relativePath: string; chunks: VectorChunk[]; metadata: Record<string, unknown>; createdAt: number; content?: string; embedding?: number[]; updatedAt?: number; syncStatus?: string; }
export interface VectorTreeNode { id: string; name: string; type: 'folder' | 'file'; parentId: string | null; order: number; relativePath: string; content: string | null; docId: string | null; syncStatus?: string; createdAt: number; updatedAt?: number; }

class VectorDB extends Dexie {
  documents!: Table<Omit<VectorDocument, 'chunks'>, string>;
  chunks!: Table<VectorChunk, number>;
  vectorTree!: Table<VectorTreeNode, string>;
  constructor() {
    super('nexaflow-vector-db');
    this.version(1).stores({
      documents: 'id, relativePath, syncStatus, createdAt, updatedAt',
      chunks: '++id, documentId, syncStatus, createdAt',
      vectorTree: 'id, parentId, relativePath, type, syncStatus, createdAt, updatedAt',
    });
  }
}

let dbInstance: VectorDB | null = null;
let initPromise: Promise<VectorDB> | null = null;

export async function initVectorStore(): Promise<VectorDB> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    dbInstance = new VectorDB();
    logger.indexeddb('initialized', { name: 'nexaflow-vector-db' });
    return dbInstance;
  })();
  initPromise.catch((e) => { logger.indexeddbError('init', e); initPromise = null; });
  return initPromise;
}

export function getVectorDB(): VectorDB | null { return dbInstance; }

// ==================== CRUD ====================
export const vectorStore = {
  async addDocument(doc: VectorDocument): Promise<void> {
    const db = getVectorDB();
    if (!db) throw new Error('VectorStore not initialized');
    await db.documents.put({ ...doc, chunks: undefined } as Omit<VectorDocument, 'chunks'>);
    logger.indexeddb('addDocument', { id: doc.id, name: doc.name });
  },
  async getDocument(id: string): Promise<VectorDocument | null> {
    const db = getVectorDB();
    if (!db) throw new Error('VectorStore not initialized');
    const doc = await db.documents.get(id);
    if (!doc) {
      logger.indexeddb('getDocument', { id, found: false });
      return null;
    }
    const chunks = await db.chunks.where('documentId').equals(id).toArray();
    logger.indexeddb('getDocument', { id, found: true, chunks: chunks.length });
    return { ...doc, chunks } as VectorDocument;
  },
  async deleteDocument(id: string): Promise<void> {
    const db = getVectorDB();
    if (!db) throw new Error('VectorStore not initialized');
    await db.transaction('rw', [db.documents, db.chunks], async () => {
      await db.chunks.where('documentId').equals(id).delete();
      await db.documents.delete(id);
    });
    logger.indexeddb('deleteDocument', { id });
  },
  async addChunk(chunk: VectorChunk): Promise<void> {
    const db = getVectorDB();
    if (!db) throw new Error('VectorStore not initialized');
    await db.chunks.add(chunk);
    logger.indexeddb('addChunk', { id: chunk.id, documentId: chunk.documentId });
  },
  async getChunks(documentId: string): Promise<VectorChunk[]> {
    const db = getVectorDB();
    if (!db) throw new Error('VectorStore not initialized');
    const chunks = await db.chunks.where('documentId').equals(documentId).toArray();
    logger.indexeddb('getChunks', { documentId, count: chunks.length });
    return chunks;
  },
  async deleteChunks(documentId: string): Promise<void> {
    const db = getVectorDB();
    if (!db) throw new Error('VectorStore not initialized');
    await db.chunks.where('documentId').equals(documentId).delete();
    logger.indexeddb('deleteChunks', { documentId });
  }
};

// ==================== SIMILARITY SEARCH ====================
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

export const vectorSearch = {
  async findSimilar(embedding: Float32Array, limit = 10): Promise<VectorChunk[]> {
    const db = getVectorDB();
    if (!db) throw new Error('VectorStore not initialized');
    const chunks = await db.chunks.toArray();
    const scored = chunks
      .map(c => ({ chunk: c, score: cosineSimilarity(Array.from(embedding), c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.chunk);
    logger.indexeddb('findSimilar', { limit, results: scored.length });
    return scored;
  }
};

// ==================== SYNC HELPERS ====================
export const vectorSyncHelpers = {
  async getPending(store: 'documents' | 'chunks'): Promise<VectorDocument[] | VectorChunk[]> {
    const db = getVectorDB();
    if (!db) throw new Error('VectorStore not initialized');
    const table = store === 'documents' ? db.documents : db.chunks;
    const items = await table.filter(item => item.syncStatus !== 'synced' && item.syncStatus !== 'deleted').toArray();
    logger.indexeddb('getPending', { store, count: items.length });
    return items as VectorDocument[] | VectorChunk[];
  },
  async markAsSynced(store: 'documents' | 'chunks', id: string): Promise<void> {
    const db = getVectorDB();
    if (!db) throw new Error('VectorStore not initialized');
    if (store === 'documents') {
      await db.documents.update(id, { syncStatus: 'synced' });
    } else {
      await db.chunks.update(id as unknown as number, { syncStatus: 'synced' });
    }
    logger.indexeddb('markAsSynced', { store, id });
  },
  async softDelete(store: 'documents' | 'chunks', id: string): Promise<void> {
    const db = getVectorDB();
    if (!db) throw new Error('VectorStore not initialized');
    if (store === 'documents') {
      await db.documents.update(id, { syncStatus: 'deleted' });
    } else {
      await db.chunks.update(id as unknown as number, { syncStatus: 'deleted' });
    }
    logger.indexeddb('softDelete', { store, id });
  },
  async getSyncStatus(store: 'documents' | 'chunks', id: string): Promise<string | null> {
    const db = getVectorDB();
    if (!db) throw new Error('VectorStore not initialized');
    const item = store === 'documents'
      ? await db.documents.get(id)
      : await db.chunks.get(id as unknown as number);
    const status = item?.syncStatus ?? null;
    logger.indexeddb('getSyncStatus', { store, id, status });
    return status;
  }
};
