import type { Database, Sqlite3Static, BindingSpec, SAHPoolUtil } from '@sqlite.org/sqlite-wasm';

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

const DB_NAME = 'nexaflow-client.sqlite';

async function openPersistentDatabase(sqlite3: Sqlite3Static): Promise<Database> {
  const oo1 = sqlite3.oo1;

  if (oo1 && typeof oo1.OpfsDb === 'function') {
    try {
      return new oo1.OpfsDb(DB_NAME);
    } catch (error) {
      console.warn('[SQLite] OpfsDb indisponible, repli sur IndexedDB (SqlJsDb).', error);
    }
  }

  if (typeof sqlite3.installOpfsSAHPoolVfs === 'function') {
    try {
      const poolUtil: SAHPoolUtil = await sqlite3.installOpfsSAHPoolVfs({ name: 'nexaflow-opfs' });
      if (poolUtil && typeof poolUtil.OpfsSAHPoolDb === 'function') {
        return new poolUtil.OpfsSAHPoolDb(DB_NAME);
      }
    } catch (error) {
      console.warn('[SQLite] OPFS SAH Pool indisponible, repli sur IndexedDB (SqlJsDb).', error);
    }
  }

  if (oo1 && typeof oo1.JsStorageDb === 'function') {
    console.warn('[SQLite] Aucun stockage OPFS persistant disponible : repli sur localStorage (les données survivront au rechargement dans la limite de stockage du navigateur).');
    try {
      return new oo1.JsStorageDb('local');
    } catch (error) {
      console.error('[SQLite] Impossible d initialiser le stockage local :', error);
      throw new Error('Stockage local indisponible. Videz les donnees du navigateur ou utilisez un navigateur supportant OPFS.');
    }
  }

  console.warn('[SQLite] Repli sur base en mémoire (les données ne survivront pas au rechargement).');
  return new oo1.DB(DB_NAME);
}

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

    db = await openPersistentDatabase(sqlite3Instance);
    initSchema(db!);
    console.log('[SQLite] Base de données locale initialisée');
    return db as Database;
  })();

  initPromise.catch(() => {
    initPromise = null;
  });

  return initPromise;
}

export function getDb(): Database | null {
  return db;
}

function wrapSqliteError(error: unknown): never {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('quotaexceedederror') || msg.includes('quota exceeded') || msg.includes('exceeded the quota')) {
      throw new Error('Quota de stockage local depasse. Videz les donnees anciennes ou utilisez un navigateur supportant OPFS.');
    }
    if (msg.includes('sqlite_error') || msg.includes('sqlite_ioerr')) {
      throw new Error(`Erreur SQLite: ${error.message}`);
    }
  }
  throw error;
}

export async function exec(sql: string): Promise<void> {
  const database = await initSqlite();
  try {
    database.exec(sql);
  } catch (error) {
    wrapSqliteError(error);
  }
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
  } catch (error) {
    wrapSqliteError(error);
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
  return new Promise((resolve) => {
    let stmt: ReturnType<typeof database.prepare> | null = null;
    try {
      stmt = database.prepare(sql);
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
      if (stmt) stmt.finalize();
      wrapSqliteError(error);
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
    CREATE TABLE IF NOT EXISTS sensor_configs (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      value REAL,
      unit TEXT,
      threshold REAL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS actuator_states (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      is_on INTEGER DEFAULT 0,
      position INTEGER,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      subtype TEXT,
      ip_address TEXT,
      port INTEGER,
      is_active INTEGER DEFAULT 1,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS iot_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT NOT NULL,
      alert INTEGER DEFAULT 0,
      resolved INTEGER DEFAULT 0,
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
    CREATE INDEX IF NOT EXISTS idx_sensor_configs_type ON sensor_configs(type);
    CREATE INDEX IF NOT EXISTS idx_actuator_states_type ON actuator_states(type);
    CREATE INDEX IF NOT EXISTS idx_iot_history_entity ON iot_history(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_iot_history_created ON iot_history(created_at);
    CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);
  `);

  migrateLocalTree(database);
  migrateIotHistory(database);
  migrateDevices(database);
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

function migrateIotHistory(database: Database): void {
  try {
    const stmt = database.prepare("PRAGMA table_info(iot_history)");
    const columnNames: string[] = [];
    while (stmt.step()) {
      const row = stmt.get({}) as Record<string, unknown>;
      columnNames.push(row.name as string);
    }
    stmt.finalize();

    if (columnNames.length > 0 && !columnNames.includes("resolved")) {
      database.exec("ALTER TABLE iot_history ADD COLUMN resolved INTEGER DEFAULT 0");
    }
  } catch {
    // table might not exist; CREATE TABLE will have handled it
  }
}

function migrateDevices(database: Database): void {
  try {
    const stmt = database.prepare("PRAGMA table_info(devices)");
    const columnNames: string[] = [];
    while (stmt.step()) {
      const row = stmt.get({}) as Record<string, unknown>;
      columnNames.push(row.name as string);
    }
    stmt.finalize();

    if (columnNames.length > 0) {
      if (!columnNames.includes("ip_address")) {
        database.exec("ALTER TABLE devices ADD COLUMN ip_address TEXT");
      }
      if (!columnNames.includes("port")) {
        database.exec("ALTER TABLE devices ADD COLUMN port INTEGER");
      }
      if (!columnNames.includes("is_active")) {
        database.exec("ALTER TABLE devices ADD COLUMN is_active INTEGER DEFAULT 1");
      }
      if (!columnNames.includes("metadata")) {
        database.exec("ALTER TABLE devices ADD COLUMN metadata TEXT DEFAULT '{}'");
      }
    }
  } catch {
    // table might not exist; CREATE TABLE will have handled it
  }
}
