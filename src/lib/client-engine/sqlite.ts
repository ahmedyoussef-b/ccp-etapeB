import type { Database, Sqlite3Static, BindingSpec } from '@sqlite.org/sqlite-wasm';

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

const DB_NAME = '/nexaflow-client.sqlite';

export async function initSqlite(): Promise<Database> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const sqlite3Module = await import('@sqlite.org/sqlite-wasm');
    const initModule = sqlite3Module.default as unknown as (options?: { print?: (msg: string) => void; printErr?: (msg: string) => void }) => Promise<Sqlite3Static>;
    const sqlite3Instance = await initModule({
      print: console.log,
      printErr: console.error,
    });

    if (typeof sqlite3Instance.oo1?.OpfsDb === 'function') {
      db = new sqlite3Instance.oo1.OpfsDb(DB_NAME);
    } else if (typeof sqlite3Instance.oo1?.DB === 'function') {
      db = new sqlite3Instance.oo1.DB(DB_NAME);
    } else {
      db = new sqlite3Instance.oo1.JsStorageDb('local');
    }

    initSchema(db!);
    console.log('[SQLite] Base de données locale initialisée');
    return db as Database;
  })();

  return initPromise;
}

export function getDb(): Database | null {
  return db;
}

export async function exec(sql: string): Promise<void> {
  const database = await initSqlite();
  database.exec(sql);
}

export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const database = await initSqlite();
  const stmt = database.prepare(sql);
  try {
    if (params.length > 0) {
      stmt.bind(params as BindingSpec);
    }
    const results: T[] = [];
    while (stmt.step()) {
      const row = stmt.get({}) as Record<string, unknown>;
      results.push(row as T);
    }
    return results;
  } finally {
    stmt.finalize();
  }
}

export async function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const results = await query<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}

export async function run(sql: string, params: unknown[] | Record<string, unknown> = []): Promise<{ changes: number; lastInsertRowid: number }> {
  const database = await initSqlite();
  return new Promise((resolve, reject) => {
    try {
      const stmt = database.prepare(sql);
      stmt.bind(params as BindingSpec);
      stmt.step();
      const changes = database.changes();
      const lastInsertRowid = db ? Number(db.selectObject('SELECT last_insert_rowid()')?.last_insert_rowid ?? 0) : 0;
      stmt.finalize();
      resolve({ changes, lastInsertRowid });
    } catch (error) {
      reject(error);
    }
  });
}

function initSchema(database: Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS qa_registries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS qa_pairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      registry_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (registry_id) REFERENCES qa_registries(id)
    );
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      messages TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS local_tree (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      remote_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      parent_id INTEGER,
      path TEXT,
      size INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS vector_documents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      original_path TEXT,
      relative_path TEXT,
      content TEXT,
      embedding TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_qa_registries_title ON qa_registries(title);
    CREATE INDEX IF NOT EXISTS idx_qa_pairs_registry ON qa_pairs(registry_id);
    CREATE INDEX IF NOT EXISTS idx_qa_pairs_question ON qa_pairs(question);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at);
    CREATE INDEX IF NOT EXISTS idx_local_tree_path ON local_tree(path);
    CREATE INDEX IF NOT EXISTS idx_vector_docs_path ON vector_documents(relative_path);
  `);
}
