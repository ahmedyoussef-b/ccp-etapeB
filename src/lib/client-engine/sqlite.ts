import type { Database, Sqlite3Static, BindingSpec } from '@sqlite.org/sqlite-wasm';

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

const DB_NAME = 'nexaflow-client.sqlite';

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
      const hasParams = Array.isArray(params) ? params.length > 0 : Object.keys(params).length > 0;
      if (hasParams) {
        stmt.bind(params as BindingSpec);
      }
      stmt.step();
      const changes = database.changes();
      const idStmt = database.prepare('SELECT last_insert_rowid() as rid');
      idStmt.step();
      const ridRow = idStmt.get({}) as { rid: number };
      const lastInsertRowid = Number(ridRow?.rid ?? 0);
      idStmt.finalize();
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
      node_order INTEGER DEFAULT 0,
      path TEXT,
      size INTEGER,
      content TEXT,
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
    CREATE INDEX IF NOT EXISTS idx_local_tree_parent ON local_tree(parent_id);
    CREATE INDEX IF NOT EXISTS idx_local_tree_node_order ON local_tree(parent_id, node_order);
    CREATE INDEX IF NOT EXISTS idx_vector_docs_path ON vector_documents(relative_path);
  `);

  migrateLocalTree(database);
}

function migrateLocalTree(database: Database): void {
  try {
    const stmt = database.prepare("PRAGMA table_info(local_tree)");
    const columnNames: string[] = [];
    while (stmt.step()) {
      const row = stmt.get({}) as Record<string, unknown>;
      columnNames.push(row.name as string);
    }
    stmt.finalize();

    if (columnNames.length > 0) {
      if (!columnNames.includes("node_order")) {
        database.exec("ALTER TABLE local_tree ADD COLUMN node_order INTEGER DEFAULT 0");
      }
      if (!columnNames.includes("content")) {
        database.exec("ALTER TABLE local_tree ADD COLUMN content TEXT");
      }
    }
  } catch {
    // table might not exist; CREATE TABLE will have handled it
  }

  try {
    database.exec("CREATE INDEX IF NOT EXISTS idx_local_tree_parent ON local_tree(parent_id)");
    database.exec("CREATE INDEX IF NOT EXISTS idx_local_tree_node_order ON local_tree(parent_id, node_order)");
  } catch {
    // index creation may fail if already exists; safe to ignore
  }
}
