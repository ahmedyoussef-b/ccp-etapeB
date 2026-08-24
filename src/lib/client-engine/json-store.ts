// ==================== LOGGER ====================
const logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsonstore: (action: string, data?: any) =>
    console.log(`[DB:JSONSTORE] ${action}`, data ? JSON.stringify(data, null, 2) : ''),
  jsonstoreError: (action: string, error: unknown) =>
    console.error(`[DB:JSONSTORE] [ERROR] ${action}`, error)
};

// ==================== STORE ====================
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

// ==================== INIT ====================
export async function initJsonStore(): Promise<void> {
  await openDb();
  logger.jsonstore('initialized', { name: DB_NAME });
}

// ==================== CRUD ====================
export const jsonStore = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async set<T = any>(key: string, value: T): Promise<void> {
    const store = tx(STORE_NAME, 'readwrite');
    await promisifyRequest(store.put({ key, value }));
    logger.jsonstore('set', { key });
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async get<T = any>(key: string): Promise<T | null> {
    const store = tx(STORE_NAME);
    const result = await promisifyRequest<{ key: string; value: T } | undefined>(store.get(key));
    logger.jsonstore('get', { key, found: !!result });
    return result?.value ?? null;
  },
  async delete(key: string): Promise<void> {
    const store = tx(STORE_NAME, 'readwrite');
    await promisifyRequest(store.delete(key));
    logger.jsonstore('delete', { key });
  },
  async list(prefix?: string): Promise<string[]> {
    const store = tx(STORE_NAME);
    const keys = (await promisifyRequest<IDBValidKey[]>(store.getAllKeys())) as string[];
    const filtered = prefix ? keys.filter(k => k.startsWith(prefix)) : keys;
    logger.jsonstore('list', { prefix, count: filtered.length });
    return filtered;
  },
  async clear(): Promise<void> {
    const store = tx(STORE_NAME, 'readwrite');
    await promisifyRequest(store.clear());
    logger.jsonstore('clear');
  }
};

// Backward-compatible wrappers
export async function jsonGet<T = unknown>(key: string): Promise<T | undefined> {
  return jsonStore.get<T>(key) as Promise<T | undefined>;
}

export async function jsonSet<T = unknown>(key: string, value: T): Promise<void> {
  return jsonStore.set(key, value);
}

export async function jsonDelete(key: string): Promise<void> {
  return jsonStore.delete(key);
}

export async function jsonClear(): Promise<void> {
  return jsonStore.clear();
}

export async function jsonKeys(): Promise<string[]> {
  return jsonStore.list();
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
