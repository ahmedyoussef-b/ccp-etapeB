const DB_NAME = "nexaflow-vision-db";
const DB_VERSION = 1;
const STORE_NAME = "images";

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
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("label", "label", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });

  return initPromise;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface ImageRecord {
  id: string;
  dataUrl: string;
  embedding: number[];
  label: string;
  createdAt: number;
}

export async function addImage(record: Omit<ImageRecord, "createdAt">): Promise<void> {
  const database = await openDb();
  const tx = database.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  await promisifyRequest(store.put({ ...record, createdAt: Date.now() }));
}

export async function getAllImages(): Promise<ImageRecord[]> {
  const database = await openDb();
  const tx = database.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();
  return promisifyRequest<ImageRecord[]>(request);
}

export async function deleteImage(id: string): Promise<void> {
  const database = await openDb();
  const tx = database.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  await promisifyRequest(store.delete(id));
}

export async function clearImages(): Promise<void> {
  const database = await openDb();
  const tx = database.transaction(STORE_NAME, "readwrite");
  await promisifyRequest(tx.objectStore(STORE_NAME).clear());
}

export async function searchImages(
  queryEmbedding: number[],
  topK = 5,
  minScore = 0.1
): Promise<Array<{ record: ImageRecord; score: number }>> {
  const images = await getAllImages();
  const scored = images
    .map((img) => ({
      record: img,
      score: cosineSimilarity(queryEmbedding, img.embedding),
    }))
    .filter((item) => item.score > minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
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
