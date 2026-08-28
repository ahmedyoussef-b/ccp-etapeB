import Dexie, { type Table } from 'dexie';
const logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  indexeddb: (action: string, data?: any) =>
    console.log(`[DB:INDEXEDDB] ${action}`, data ? JSON.stringify(data, null, 2) : ''),
  indexeddbError: (action: string, error: unknown) =>
    console.error(`[DB:INDEXEDDB] [ERROR] ${action}`, error)
};

export interface VectorChunk { id?: number; documentId: string; documentName?: string; chunkIndex: number; content: string; embedding: number[]; metadata?: Record<string, unknown>; createdAt?: number; syncStatus?: string; }
export interface VectorDocument { id: string; name: string; originalPath: string; relativePath: string; chunks: VectorChunk[]; metadata: Record<string, unknown>; createdAt?: number; content?: string; embedding?: number[]; updatedAt?: number; syncStatus?: string; }
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

// ==================== EXPORTS DESCENDANTS ====================
export const addDocument = async (doc: VectorDocument): Promise<void> => {
  return vectorStore.addDocument(doc);
};

export const getDocument = async (id: string): Promise<VectorDocument | null> => {
  return vectorStore.getDocument(id);
};

export const deleteDocument = async (id: string): Promise<void> => {
  return vectorStore.deleteDocument(id);
};

export const getChunksByDocumentId = async (documentId: string): Promise<VectorChunk[]> => {
  return vectorStore.getChunks(documentId);
};

export const getAllDocuments = async (): Promise<VectorDocument[]> => {
  const db = getVectorDB();
  if (!db) throw new Error('VectorStore not initialized');
  const docs = await db.documents.toArray();
  const result: VectorDocument[] = [];
  for (const doc of docs) {
    const chunks = (await db.chunks.where('documentId').equals(doc.id).toArray())
      .map(c => ({ ...c, documentName: c.documentName ?? doc.name }));
    result.push({ ...doc, chunks });
  }
  logger.indexeddb('getAllDocuments', { count: result.length });
  return result;
};

export const clearVectorStore = async (): Promise<void> => {
  const db = getVectorDB();
  if (!db) throw new Error('VectorStore not initialized');
  await db.transaction('rw', [db.documents, db.chunks], async () => {
    await db.documents.clear();
    await db.chunks.clear();
  });
  logger.indexeddb('clearVectorStore');
};

export const getStats = async (): Promise<{ documentCount: number; chunkCount: number }> => {
  const db = getVectorDB();
  if (!db) throw new Error('VectorStore not initialized');
  const documentCount = await db.documents.count();
  const chunkCount = await db.chunks.count();
  logger.indexeddb('getStats', { documentCount, chunkCount });
  return { documentCount, chunkCount };
};

export const simpleTokenEmbedding = (text: string): number[] => {
  const EMBEDDING_DIM = 384;
  const vec = new Array(EMBEDDING_DIM).fill(0);
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash * 31 + token.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % EMBEDDING_DIM;
    vec[idx] += 1;
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      vec[i] /= norm;
    }
  }
  return vec;
};

export const searchByEmbedding = async (embedding: number[] | Float32Array, limit = 10): Promise<Array<VectorChunk & { score: number }>> => {
  const db = getVectorDB();
  if (!db) throw new Error('VectorStore not initialized');
  const embedArray = Array.from(embedding);
  const chunks = await db.chunks.toArray();
  const scored = chunks
    .map(c => ({ chunk: c, score: cosineSimilarity(embedArray, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  logger.indexeddb('searchByEmbedding', { limit, results: scored.length });
  return scored.map(s => ({ ...s.chunk, score: s.score }));
};

export const getAllVectorTreeNodes = async (): Promise<VectorTreeNode[]> => {
  const db = getVectorDB();
  if (!db) throw new Error('VectorStore not initialized');
  return db.vectorTree.toArray();
};

export const addVectorTreeNode = async (node: Omit<VectorTreeNode, 'createdAt'>): Promise<void> => {
  const db = getVectorDB();
  if (!db) throw new Error('VectorStore not initialized');
  await db.vectorTree.put({ ...node, syncStatus: node.syncStatus ?? 'pending' } as VectorTreeNode);
  logger.indexeddb('addVectorTreeNode', { id: node.id, name: node.name });
};

export const deleteVectorTreeNode = async (id: string): Promise<void> => {
  const db = getVectorDB();
  if (!db) throw new Error('VectorStore not initialized');
  await db.vectorTree.delete(id);
  logger.indexeddb('deleteVectorTreeNode', { id });
};

export const clearVectorTree = async (): Promise<void> => {
  const db = getVectorDB();
  if (!db) throw new Error('VectorStore not initialized');
  await db.vectorTree.clear();
  logger.indexeddb('clearVectorTree');
};

export const syncMirrorStructure = async (nodes: Array<{
  id: string | number;
  name: string;
  type: string;
  parentId?: string | number | null;
  path?: string;
  children?: Array<{
    id: string | number;
    name: string;
    type: string;
    parentId?: string | number | null;
    path?: string;
    children?: Array<{
      id: string | number;
      name: string;
      type: string;
      parentId?: string | number | null;
      path?: string;
    }>;
  }>;
}>): Promise<{ added: number }> => {
  const db = getVectorDB();
  if (!db) throw new Error('VectorStore not initialized');

  const flat: Array<{
    id: string;
    name: string;
    type: 'folder';
    parentId: string | null;
    relativePath: string;
  }> = []

  const walk = (items: typeof nodes, parentId: string | null, basePath: string) => {
    for (const node of items) {
      const type = String(node.type || '').toLowerCase()
      if (type !== 'directory' && type !== 'root') {
        if (node.children) {
          walk(node.children, parentId, basePath)
        }
        continue
      }

      const relativePath = basePath ? `${basePath}/${node.name}` : node.name
      flat.push({
        id: `vdir-${node.id}`,
        name: node.name,
        type: 'folder',
        parentId,
        relativePath,
      })

      if (node.children && node.children.length > 0) {
        walk(node.children, `vdir-${node.id}`, relativePath)
      }
    }
  }

  walk(nodes, null, '')

  for (const node of flat) {
    await db.vectorTree.put({
      id: node.id,
      name: node.name,
      type: node.type,
      parentId: node.parentId,
      order: 0,
      relativePath: node.relativePath,
      content: null,
      docId: null,
      syncStatus: 'synced',
      createdAt: Date.now(),
    })
  }

  logger.indexeddb('syncMirrorStructure', { added: flat.length })
  return { added: flat.length }
};
