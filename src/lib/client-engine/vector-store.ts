interface VectorChunk {
  id?: number;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
  createdAt?: number;
}

export interface VectorDocument {
  id: string;
  name: string;
  originalPath: string;
  relativePath: string;
  chunks: VectorChunk[];
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface VectorTreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  parentId: string | null;
  order: number;
  relativePath: string;
  content: string | null;
  docId: string | null;
  createdAt: number;
}

const DB_NAME = 'nexaflow-vector-db';
const DB_VERSION = 2;
const CHUNKS_STORE = 'chunks';
const DOCUMENTS_STORE = 'documents';
const TREE_STORE = 'vector_tree';

let dbInstance: IDBDatabase | null = null;
let initPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(CHUNKS_STORE)) {
        const chunksStore = database.createObjectStore(CHUNKS_STORE, { keyPath: 'id', autoIncrement: true });
        chunksStore.createIndex('documentId', 'documentId', { unique: false });
        chunksStore.createIndex('relativePath', 'relativePath', { unique: false });
      }

      if (!database.objectStoreNames.contains(DOCUMENTS_STORE)) {
        const docsStore = database.createObjectStore(DOCUMENTS_STORE, { keyPath: 'id' });
        docsStore.createIndex('relativePath', 'relativePath', { unique: true });
      }

      if (!database.objectStoreNames.contains(TREE_STORE)) {
        const treeStore = database.createObjectStore(TREE_STORE, { keyPath: 'id' });
        treeStore.createIndex('parentId', 'parentId', { unique: false });
        treeStore.createIndex('relativePath', 'relativePath', { unique: false });
      }
    };
  });

  return initPromise;
}

function tx(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
  const database = dbInstance!;
  const transaction = database.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function initVectorStore(): Promise<void> {
  await openDb();
  console.log('[VectorStore] Base de données vectorielle IndexedDB initialisée');
}

export async function clearVectorStore(): Promise<void> {
  await openDb();
  const chunksTx = dbInstance!.transaction(CHUNKS_STORE, 'readwrite');
  const docsTx = dbInstance!.transaction(DOCUMENTS_STORE, 'readwrite');
  chunksTx.objectStore(CHUNKS_STORE).clear();
  docsTx.objectStore(DOCUMENTS_STORE).clear();

  if (dbInstance!.objectStoreNames.contains(TREE_STORE)) {
    const treeTx = dbInstance!.transaction(TREE_STORE, 'readwrite');
    treeTx.objectStore(TREE_STORE).clear();
  }
}

export async function addDocument(doc: Omit<VectorDocument, 'createdAt'>): Promise<void> {
  await openDb();
  const document: VectorDocument = { ...doc, createdAt: Date.now() };

  const docsStore = tx(DOCUMENTS_STORE, 'readwrite');
  await promisifyRequest(docsStore.put(document));

  const chunksStore = tx(CHUNKS_STORE, 'readwrite');
  for (const chunk of doc.chunks) {
    const record: VectorChunk = {
      ...chunk,
      documentId: doc.id,
      createdAt: Date.now(),
    };
    await promisifyRequest(chunksStore.add(record));
  }
}

export async function getDocument(id: string): Promise<VectorDocument | null> {
  const docsStore = tx(DOCUMENTS_STORE);
  const result = await promisifyRequest<VectorDocument | undefined>(docsStore.get(id));
  return result ?? null;
}

export async function getAllDocuments(): Promise<VectorDocument[]> {
  const docsStore = tx(DOCUMENTS_STORE);
  const request = docsStore.getAll();
  return promisifyRequest<VectorDocument[]>(request);
}

export async function deleteDocument(id: string): Promise<void> {
  await openDb();
  const docsStore = tx(DOCUMENTS_STORE, 'readwrite');
  const chunksStore = tx(CHUNKS_STORE, 'readwrite');

  await promisifyRequest(docsStore.delete(id));
  const index = chunksStore.index('documentId');
  const request = index.openCursor(IDBKeyRange.only(id));
  
  await new Promise<void>((resolve, reject) => {
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function addChunks(chunks: Omit<VectorChunk, 'id' | 'createdAt'>[]): Promise<void> {
  await openDb();
  const chunksStore = tx(CHUNKS_STORE, 'readwrite');
  for (const chunk of chunks) {
    const record: VectorChunk = { ...chunk, createdAt: Date.now() };
    await promisifyRequest(chunksStore.add(record));
  }
}

export async function searchByEmbedding(
  queryEmbedding: number[],
  topK = 5,
  minScore = 0.1
): Promise<Array<{ content: string; score: number; documentId: string; documentName: string; metadata?: Record<string, unknown> }>> {
  await openDb();
  const chunksStore = tx(CHUNKS_STORE);
  const request = chunksStore.getAll();

  const allChunks = await promisifyRequest<VectorChunk[]>(request);

  const scored = allChunks
    .filter((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0)
    .map((chunk) => {
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      return {
        content: chunk.content,
        score,
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        metadata: chunk.metadata,
      };
    })
    .filter((item) => item.score > minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

export async function searchByText(
  query: string,
  topK = 5
): Promise<Array<{ content: string; score: number; documentId: string; documentName: string; metadata?: Record<string, unknown> }>> {
  await openDb();
  const chunksStore = tx(CHUNKS_STORE);
  const request = chunksStore.getAll();

  const allChunks = await promisifyRequest<VectorChunk[]>(request);
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/[\s,.;:!?()[\]{}]+/).filter(Boolean);

  const scored = allChunks
    .map((chunk) => {
      const contentLower = chunk.content.toLowerCase();
      let matches = 0;
      for (const term of queryTerms) {
        if (contentLower.includes(term)) matches++;
      }
      const score = queryTerms.length > 0 ? matches / queryTerms.length : 0;
      return {
        content: chunk.content,
        score,
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        metadata: chunk.metadata,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

export async function getStats(): Promise<{ documentCount: number; chunkCount: number }> {
  const documents = await getAllDocuments();
  await openDb();
  const chunksStore = tx(CHUNKS_STORE);
  const countRequest = chunksStore.count();
  const chunkCount = await promisifyRequest(countRequest);
  return { documentCount: documents.length, chunkCount };
}

export async function addVectorTreeNode(node: Omit<VectorTreeNode, 'createdAt'>): Promise<void> {
  await openDb();
  const treeStore = tx(TREE_STORE, 'readwrite');
  const record: VectorTreeNode = { ...node, createdAt: Date.now() };
  await promisifyRequest(treeStore.put(record));
}

export async function getAllVectorTreeNodes(): Promise<VectorTreeNode[]> {
  await openDb();
  const treeStore = tx(TREE_STORE);
  const request = treeStore.getAll();
  return promisifyRequest<VectorTreeNode[]>(request);
}

export async function deleteVectorTreeNode(id: string): Promise<void> {
  await openDb();
  const treeStore = tx(TREE_STORE, 'readwrite');
  await promisifyRequest(treeStore.delete(id));
}

export async function clearVectorTree(): Promise<void> {
  await openDb();
  const treeStore = tx(TREE_STORE, 'readwrite');
  treeStore.clear();
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export function simpleTokenEmbedding(text: string): number[] {
  const tokens = text.toLowerCase().split(/[\s,.;:!?()[\]{}]+/).filter(Boolean);
  const vec = new Array(64).fill(0);
  for (let i = 0; i < tokens.length; i++) {
    const h = ((tokens[i].split('').reduce((s, c) => s + c.charCodeAt(0), 0) + i) % 64);
    vec[h] += 1;
  }
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / mag);
}
