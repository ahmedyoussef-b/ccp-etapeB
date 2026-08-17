const DB_NAME = 'nexaflow-json-db';
const DB_VERSION = 1;
const STORE_NAME = 'json-store';

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
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
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

function tx(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
  const database = dbInstance!;
  const transaction = database.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

export async function initJsonStore(): Promise<void> {
  await openDb();
  console.log('[JsonStore] Base de données JSON IndexedDB initialisée');
}

export async function jsonGet<T = unknown>(key: string): Promise<T | undefined> {
  const store = tx(STORE_NAME);
  const result = await promisifyRequest<{ key: string; value: T } | undefined>(store.get(key));
  return result?.value;
}

export async function jsonSet<T = unknown>(key: string, value: T): Promise<void> {
  const store = tx(STORE_NAME, 'readwrite');
  await promisifyRequest(store.put({ key, value }));
}

export async function jsonDelete(key: string): Promise<void> {
  const store = tx(STORE_NAME, 'readwrite');
  await promisifyRequest(store.delete(key));
}

export async function jsonClear(): Promise<void> {
  const store = tx(STORE_NAME, 'readwrite');
  await promisifyRequest(store.clear());
}

export async function jsonKeys(): Promise<string[]> {
  const store = tx(STORE_NAME);
  const request = store.getAllKeys();
  return (await promisifyRequest(request)) as string[];
}

export async function jsonGetAll<T = unknown>(): Promise<Record<string, T>> {
  const store = tx(STORE_NAME);
  const request = store.getAll();
  const entries = await promisifyRequest<{ key: string; value: T }[]>(request);
  return entries.reduce((acc, entry) => {
    acc[entry.key] = entry.value;
    return acc;
  }, {} as Record<string, T>);
}
