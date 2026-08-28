import type { Database, Sqlite3Static, BindingSpec, SAHPoolUtil } from '@sqlite.org/sqlite-wasm';

type SQLiteStorage = 'opfs' | 'indexeddb' | 'memory';
const SQLITE_CONFIG: { persist: boolean; filename: string; storage: SQLiteStorage } = { persist: true, filename: 'nexaflow-client.sqlite', storage: 'opfs' };
const logger = {
  sqlite: (action: string, data?: unknown) => console.log('[DB:SQLITE]', action, data ? JSON.stringify(data, null, 2) : ''),
  sqliteError: (action: string, error: unknown) => console.error('[DB:SQLITE]', '[ERROR]', action, error instanceof Error ? error.message : String(error)),
};

const SCHEMA_VERSION = 5;

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;
let storageUsed: SQLiteStorage = 'memory';

async function openPersistentDatabase(s3: Sqlite3Static): Promise<Database> {
  const oo1 = s3.oo1;

  if (typeof s3.installOpfsSAHPoolVfs === 'function') {
    try {
      const poolUtil: SAHPoolUtil = await s3.installOpfsSAHPoolVfs({ name: 'nexaflow-opfs-sah' });
      if (poolUtil && typeof poolUtil.OpfsSAHPoolDb === 'function') {
        logger.sqlite('openDatabase', { storage: 'opfs-sah' });
        storageUsed = 'opfs';
        return new poolUtil.OpfsSAHPoolDb(SQLITE_CONFIG.filename);
      }
    } catch (e) {
      logger.sqliteError('openDatabase (SAH Pool)', e);
    }
  }

  if (oo1 && typeof oo1.OpfsDb === 'function') {
    try {
      logger.sqlite('openDatabase', { storage: 'opfs-direct' });
      storageUsed = 'opfs';
      return new oo1.OpfsDb(SQLITE_CONFIG.filename);
    } catch (e) {
      logger.sqliteError('openDatabase (OPFS direct)', e);
    }
  }

  if (oo1 && typeof oo1.JsStorageDb === 'function') {
    logger.sqlite('openDatabase', { storage: 'indexeddb' });
    storageUsed = 'indexeddb';
    return new oo1.JsStorageDb('local');
  }

  logger.sqlite('openDatabase', { storage: 'memory' });
  storageUsed = 'memory';
  return new oo1.DB(SQLITE_CONFIG.filename);
}

export async function createProcedureTables(db: Database): Promise<void> {
  const tableSqls = [
    `CREATE TABLE IF NOT EXISTS procedures (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, code TEXT UNIQUE NOT NULL, title TEXT NOT NULL, description TEXT, category TEXT NOT NULL, priority TEXT DEFAULT 'moyenne', estimated_time_minutes INTEGER DEFAULT 1, status TEXT DEFAULT 'draft', author_id TEXT, author_name TEXT, approver_id TEXT, approver_name TEXT, review_date TEXT, version TEXT DEFAULT '1.0', language TEXT DEFAULT 'fr-FR', body TEXT NOT NULL, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));`,
    `CREATE TABLE IF NOT EXISTS procedure_required_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, procedure_id INTEGER NOT NULL, role TEXT NOT NULL, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (procedure_id) REFERENCES procedures(id) ON DELETE CASCADE);`,
    `CREATE TABLE IF NOT EXISTS procedure_safety_instructions (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, procedure_id INTEGER NOT NULL, instruction TEXT NOT NULL, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (procedure_id) REFERENCES procedures(id) ON DELETE CASCADE);`,
    `CREATE TABLE IF NOT EXISTS procedure_tags (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, procedure_id INTEGER NOT NULL, tag TEXT NOT NULL, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (procedure_id) REFERENCES procedures(id) ON DELETE CASCADE);`,
    `CREATE TABLE IF NOT EXISTS procedure_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, procedure_code TEXT NOT NULL, version TEXT NOT NULL, body TEXT NOT NULL, created_by TEXT, created_by_name TEXT, comment TEXT, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));`,
  ];
  for (const sql of tableSqls) { db.exec(sql); }

  const tables = [
    'procedures', 'procedure_required_roles', 'procedure_safety_instructions', 'procedure_tags', 'procedure_versions',
  ];
  for (const table of tables) {
    try {
      const colCheck = await queryOne<{ cid: number }>(`SELECT cid FROM pragma_table_info('${table}') WHERE name = 'sync_status'`);
      if (!colCheck) {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN sync_status TEXT DEFAULT 'pending'`);
        await db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at DATETIME`);
      }
    } catch (e) {
      logger.sqliteError('createProcedureTables', { table, error: e });
    }
  }

  const indexSqls = [
    `CREATE INDEX IF NOT EXISTS idx_procedures_uuid ON procedures(uuid);`,
    `CREATE INDEX IF NOT EXISTS idx_procedures_sync ON procedures(sync_status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_procedures_code ON procedures(code);`,
    `CREATE INDEX IF NOT EXISTS idx_prr_sync ON procedure_required_roles(sync_status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_prr_pid ON procedure_required_roles(procedure_id);`,
    `CREATE INDEX IF NOT EXISTS idx_psi_sync ON procedure_safety_instructions(sync_status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_psi_pid ON procedure_safety_instructions(procedure_id);`,
    `CREATE INDEX IF NOT EXISTS idx_pt_sync ON procedure_tags(sync_status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_pt_pid ON procedure_tags(procedure_id);`,
    `CREATE INDEX IF NOT EXISTS idx_pv_sync ON procedure_versions(sync_status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_pv_deleted ON procedure_versions(deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_pv_code ON procedure_versions(procedure_code);`,
  ];
  for (const sql of indexSqls) { db.exec(sql); }
  logger.sqlite('create tables', { tables: ['procedures', 'procedure_required_roles', 'procedure_safety_instructions', 'procedure_tags', 'procedure_versions'] });
}

export async function createOtherTables(db: Database): Promise<void> {
  logger.sqlite('create other tables', { started: true });
  const tableSqls = [
    `CREATE TABLE IF NOT EXISTS approvals (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, procedure_id INTEGER REFERENCES procedures(id) ON DELETE CASCADE, approver_id TEXT NOT NULL, approver_name TEXT, approver_role TEXT, status TEXT DEFAULT 'pending', comment TEXT, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
    `CREATE TABLE IF NOT EXISTS local_tree (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE, remote_id TEXT, name TEXT NOT NULL, type TEXT NOT NULL, parent_id INTEGER, node_order INTEGER DEFAULT 0, path TEXT, size INTEGER DEFAULT 0, content TEXT, metadata TEXT, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
    `CREATE TABLE IF NOT EXISTS qa_registries (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, title TEXT NOT NULL, description TEXT, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
    `CREATE TABLE IF NOT EXISTS qa_pairs (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, question TEXT NOT NULL, answer TEXT NOT NULL, order_idx INTEGER DEFAULT 0, registry_id INTEGER REFERENCES qa_registries(id) ON DELETE CASCADE, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
    `CREATE TABLE IF NOT EXISTS media_items (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, description TEXT, kind TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, data_url TEXT NOT NULL, thumbnail_data_url TEXT, geolocation TEXT, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
    `CREATE TABLE IF NOT EXISTS media_item_tags (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, media_item_id INTEGER REFERENCES media_items(id) ON DELETE CASCADE, tag TEXT NOT NULL, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
    `CREATE TABLE IF NOT EXISTS sync_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, model_name TEXT NOT NULL, record_id TEXT, record_uuid TEXT, operation TEXT NOT NULL, status TEXT DEFAULT 'pending', source TEXT, target TEXT, error TEXT, metadata TEXT, deleted_at DATETIME, synced_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
    `CREATE TABLE IF NOT EXISTS iot_sensor_states (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, value REAL NOT NULL, unit TEXT NOT NULL, threshold REAL NOT NULL, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
    `CREATE TABLE IF NOT EXISTS iot_actuator_states (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, is_on INTEGER DEFAULT 0, position INTEGER, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
    `CREATE TABLE IF NOT EXISTS chat_sessions (id TEXT PRIMARY KEY, title TEXT, messages TEXT, created_at INTEGER, updated_at INTEGER);`,
    `CREATE TABLE IF NOT EXISTS sensor_configs (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT, value REAL, unit TEXT, threshold REAL, updated_at INTEGER);`,
    `CREATE TABLE IF NOT EXISTS actuator_states (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT, is_on INTEGER DEFAULT 0, position REAL, updated_at INTEGER);`,
    `CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT, subtype TEXT, ip_address TEXT, port INTEGER, is_active INTEGER DEFAULT 1, metadata TEXT, created_at INTEGER, updated_at INTEGER);`,
    `CREATE TABLE IF NOT EXISTS iot_history (id TEXT PRIMARY KEY, entity_type TEXT, entity_id TEXT, field TEXT, old_value TEXT, new_value TEXT, alert INTEGER DEFAULT 0, resolved INTEGER DEFAULT 0, created_at INTEGER);`,
    `CREATE TABLE IF NOT EXISTS vector_documents (id TEXT PRIMARY KEY, name TEXT, original_path TEXT, relative_path TEXT, content TEXT, embedding TEXT, metadata TEXT, created_at INTEGER);`,
    `CREATE TABLE IF NOT EXISTS json_store (key TEXT PRIMARY KEY, value TEXT, syncStatus TEXT, updatedAt INTEGER);`,
    `CREATE TABLE IF NOT EXISTS sync_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
  ];
  for (const sql of tableSqls) { db.exec(sql); }

  const tables = [
    'approvals', 'local_tree', 'qa_registries', 'qa_pairs', 'media_items', 'media_item_tags',
    'sync_logs', 'iot_sensor_states', 'iot_actuator_states', 'sync_metadata',
  ];
  for (const table of tables) {
    try {
      const colCheck = await queryOne<{ cid: number }>(`SELECT cid FROM pragma_table_info('${table}') WHERE name = 'sync_status'`);
      if (!colCheck) {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN sync_status TEXT DEFAULT 'pending'`);
        await db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at DATETIME`);
      }
      if (table === 'local_tree') {
        const metaCheck = await queryOne<{ cid: number }>(`SELECT cid FROM pragma_table_info('local_tree') WHERE name = 'metadata'`);
        if (!metaCheck) {
          await db.exec(`ALTER TABLE local_tree ADD COLUMN metadata TEXT`);
        }
      }
    } catch (e) {
      logger.sqliteError('createOtherTables', { table, error: e });
    }
  }

  const indexSqls = [
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_local_tree_uuid ON local_tree(uuid);`,
    `CREATE INDEX IF NOT EXISTS idx_app_procedure_id ON approvals(procedure_id);`,
    `CREATE INDEX IF NOT EXISTS idx_app_status ON approvals(status);`,
    `CREATE INDEX IF NOT EXISTS idx_app_sync_deleted ON approvals(sync_status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_tn_parent_id ON local_tree(parent_id);`,
    `CREATE INDEX IF NOT EXISTS idx_tn_type ON local_tree(type);`,
    `CREATE INDEX IF NOT EXISTS idx_tn_sync_deleted ON local_tree(sync_status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_qr_title ON qa_registries(title);`,
    `CREATE INDEX IF NOT EXISTS idx_qr_sync_deleted ON qa_registries(sync_status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_qp_registry_id ON qa_pairs(registry_id);`,
    `CREATE INDEX IF NOT EXISTS idx_qp_question ON qa_pairs(question);`,
    `CREATE INDEX IF NOT EXISTS idx_qp_sync_deleted ON qa_pairs(sync_status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_mi_category ON media_items(category);`,
    `CREATE INDEX IF NOT EXISTS idx_mi_kind ON media_items(kind);`,
    `CREATE INDEX IF NOT EXISTS idx_mi_sync_deleted ON media_items(sync_status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_mit_media_item_id ON media_item_tags(media_item_id);`,
    `CREATE INDEX IF NOT EXISTS idx_mit_sync_deleted ON media_item_tags(sync_status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_sl_model_name ON sync_logs(model_name);`,
    `CREATE INDEX IF NOT EXISTS idx_sl_record_uuid ON sync_logs(record_uuid);`,
    `CREATE INDEX IF NOT EXISTS idx_sl_status ON sync_logs(status);`,
    `CREATE INDEX IF NOT EXISTS idx_sl_sync_deleted ON sync_logs(status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_sl_deleted ON sync_logs(deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_sl_synced_at ON sync_logs(synced_at);`,
    `CREATE INDEX IF NOT EXISTS idx_iss_sync_deleted ON iot_sensor_states(sync_status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_ias_sync_deleted ON iot_actuator_states(sync_status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_cs_updated_at ON chat_sessions(updated_at);`,
    `CREATE INDEX IF NOT EXISTS idx_sc_name ON sensor_configs(name);`,
    `CREATE INDEX IF NOT EXISTS idx_as_name ON actuator_states(name);`,
    `CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);`,
    `CREATE INDEX IF NOT EXISTS idx_ih_entity ON iot_history(entity_id, entity_type);`,
    `CREATE INDEX IF NOT EXISTS idx_ih_alert ON iot_history(alert);`,
    `CREATE INDEX IF NOT EXISTS idx_vd_relative_path ON vector_documents(relative_path);`,
  ];
  for (const sql of indexSqls) { db.exec(sql); }
  logger.sqlite('create other tables', { completed: true });
}

export async function migrateLocalTree(db: Database): Promise<void> {
  logger.sqlite('migrate local_tree', { started: true });

  try {
    const hasLocalTree = await queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='local_tree'`);
    const hasTreeNodes = await queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='tree_nodes'`);

    if (!hasLocalTree || hasLocalTree.count === 0) {
      if (hasTreeNodes && hasTreeNodes.count > 0) {
        logger.sqlite('migrate local_tree', { action: 'renaming tree_nodes to local_tree' });
        await db.exec(`ALTER TABLE tree_nodes RENAME TO local_tree_old`);
        await db.exec(`CREATE TABLE local_tree (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE, remote_id TEXT, name TEXT NOT NULL, type TEXT NOT NULL, parent_id INTEGER, node_order INTEGER DEFAULT 0, path TEXT, size INTEGER DEFAULT 0, content TEXT, metadata TEXT, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        await db.exec(`INSERT INTO local_tree SELECT id, uuid, NULL as remote_id, name, type, parent_id, order_idx as node_order, NULL as path, 0 as size, metadata, sync_status, deleted_at, created_at, updated_at FROM local_tree_old`);
        await db.exec(`DROP TABLE local_tree_old`);
      } else {
        logger.sqlite('migrate local_tree', { action: 'creating local_tree' });
        await db.exec(`CREATE TABLE local_tree (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE, remote_id TEXT, name TEXT NOT NULL, type TEXT NOT NULL, parent_id INTEGER, node_order INTEGER DEFAULT 0, path TEXT, size INTEGER DEFAULT 0, content TEXT, metadata TEXT, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
      }
    }

    const columnsToAdd: Array<{ column: string; definition: string }> = [
      { column: 'uuid', definition: `uuid TEXT` },
      { column: 'remote_id', definition: `remote_id TEXT` },
      { column: 'path', definition: `path TEXT` },
      { column: 'size', definition: `size INTEGER DEFAULT 0` },
      { column: 'content', definition: `content TEXT` },
      { column: 'metadata', definition: `metadata TEXT` },
      { column: 'node_order', definition: `node_order INTEGER DEFAULT 0` },
      { column: 'sync_status', definition: `sync_status TEXT DEFAULT 'pending'` },
      { column: 'deleted_at', definition: `deleted_at DATETIME` },
      { column: 'created_at', definition: `created_at DATETIME DEFAULT CURRENT_TIMESTAMP` },
      { column: 'updated_at', definition: `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP` },
    ];

    for (const col of columnsToAdd) {
      try {
        const colCheck = await queryOne<{ cid: number }>(`SELECT cid FROM pragma_table_info('local_tree') WHERE name = '${col.column}'`);
        if (!colCheck) {
          await db.exec(`ALTER TABLE local_tree ADD COLUMN ${col.definition}`);
          logger.sqlite('migrate local_tree', { addedColumn: col.column });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.sqliteError('migrate local_tree', { column: col.column, error: message });
      }
    }

    const indexSqls = [
      `CREATE INDEX IF NOT EXISTS idx_lt_parent_id ON local_tree(parent_id);`,
      `CREATE INDEX IF NOT EXISTS idx_lt_type ON local_tree(type);`,
      `CREATE INDEX IF NOT EXISTS idx_lt_sync_deleted ON local_tree(sync_status, deleted_at);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_lt_uuid ON local_tree(uuid);`,
    ];
    for (const sql of indexSqls) {
      try { db.exec(sql); } catch { /* ignore */ }
    }

    logger.sqlite('migrate local_tree', { completed: true });

    const schemaRows = await query<Record<string, unknown>>(`PRAGMA table_info('local_tree')`);
    logger.sqlite('migrate local_tree', { schema: schemaRows });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.sqliteError('migrate local_tree', message);
  }
}

export async function createExecutionTables(db: Database): Promise<void> {
  logger.sqlite('create execution tables', { started: true });
  const tableSqls = [
    `CREATE TABLE IF NOT EXISTS procedure_executions (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, procedure_id INTEGER REFERENCES procedures(id) ON DELETE CASCADE, user_id TEXT, user_name TEXT, user_role TEXT, phase TEXT DEFAULT 'briefing', current_step_index INTEGER DEFAULT 0, started_at DATETIME DEFAULT CURRENT_TIMESTAMP, finished_at DATETIME, global_elapsed INTEGER DEFAULT 0, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
    `CREATE TABLE IF NOT EXISTS execution_steps (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, execution_id INTEGER REFERENCES procedure_executions(id) ON DELETE CASCADE, step_id TEXT NOT NULL, step_order INTEGER, title TEXT, type TEXT, is_mandatory INTEGER DEFAULT 0, is_completed INTEGER DEFAULT 0, timer_enabled INTEGER DEFAULT 0, timer_seconds INTEGER DEFAULT 0, started_at DATETIME, finished_at DATETIME, anomaly TEXT, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
    `CREATE TABLE IF NOT EXISTS execution_media (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, execution_id INTEGER REFERENCES procedure_executions(id) ON DELETE CASCADE, step_id TEXT, type TEXT, url TEXT, filename TEXT, mime_type TEXT, size INTEGER, geolocation TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, captured_at DATETIME DEFAULT CURRENT_TIMESTAMP, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
    `CREATE TABLE IF NOT EXISTS execution_completed_steps (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, execution_id INTEGER REFERENCES procedure_executions(id) ON DELETE CASCADE, step_id TEXT NOT NULL, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
    `CREATE TABLE IF NOT EXISTS execution_anomalies (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, execution_id INTEGER REFERENCES procedure_executions(id) ON DELETE CASCADE, anomaly TEXT NOT NULL, sync_status TEXT DEFAULT 'pending', deleted_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
  ];
  for (const sql of tableSqls) { db.exec(sql); }

  const tables = [
    'procedure_executions', 'execution_steps', 'execution_media',
    'execution_completed_steps', 'execution_anomalies',
  ];
  for (const table of tables) {
    try {
      const colCheck = await queryOne<{ cid: number }>(`SELECT cid FROM pragma_table_info('${table}') WHERE name = 'sync_status'`);
      if (!colCheck) {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN sync_status TEXT DEFAULT 'pending'`);
        await db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at DATETIME`);
      }
    } catch (e) {
      logger.sqliteError('createExecutionTables', { table, error: e });
    }
  }

  const indexSqls = [
    `CREATE INDEX IF NOT EXISTS idx_pe_procedure_id ON procedure_executions(procedure_id);`,
    `CREATE INDEX IF NOT EXISTS idx_pe_user_id ON procedure_executions(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_pe_sync_deleted ON procedure_executions(sync_status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_es_execution_id ON execution_steps(execution_id);`,
    `CREATE INDEX IF NOT EXISTS idx_es_step_id ON execution_steps(step_id);`,
    `CREATE INDEX IF NOT EXISTS idx_es_sync_deleted ON execution_steps(sync_status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_em_execution_id ON execution_media(execution_id);`,
    `CREATE INDEX IF NOT EXISTS idx_em_step_id ON execution_media(step_id);`,
    `CREATE INDEX IF NOT EXISTS idx_em_sync_deleted ON execution_media(sync_status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_ecs_execution_id ON execution_completed_steps(execution_id);`,
    `CREATE INDEX IF NOT EXISTS idx_ecs_sync_deleted ON execution_completed_steps(sync_status, deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_ea_execution_id ON execution_anomalies(execution_id);`,
    `CREATE INDEX IF NOT EXISTS idx_ea_sync_deleted ON execution_anomalies(sync_status, deleted_at);`,
  ];
  for (const sql of indexSqls) { db.exec(sql); }
  logger.sqlite('create execution tables', { completed: true });
}

export async function initSQLite(): Promise<Database> {
  if (typeof window === 'undefined') {
    throw new Error('SQLite can only be initialized in the browser');
  }
  if (db) return db;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const mod = await import('@sqlite.org/sqlite-wasm');
    const init = mod.default as unknown as (opts?: { print?: (m: string) => void; printErr?: (m: string) => void }) => Promise<Sqlite3Static>;
    const s3 = await init({ print: (m) => logger.sqlite('wasm', { msg: m }), printErr: (m) => logger.sqliteError('wasm', m) });
    db = await openPersistentDatabase(s3);
    await createProcedureTables(db);
    await createExecutionTables(db);
    await createOtherTables(db);
    await migrateLocalTree(db);
    await _migrate(db);
    logger.sqlite('initialized', { storage: storageUsed, persist: SQLITE_CONFIG.persist, filename: SQLITE_CONFIG.filename });
    return db;
  })();
  initPromise.catch((e) => { logger.sqliteError('init', e); initPromise = null; });
  return initPromise;
}

async function _migrate(db: Database): Promise<void> {
  await db.exec(`CREATE TABLE IF NOT EXISTS _schema_version (version INTEGER PRIMARY KEY)`);
  const currentVersion = await queryOne<{ version: number }>(`SELECT version FROM _schema_version LIMIT 1`);
  const version = currentVersion?.version ?? 0;
  if (version >= SCHEMA_VERSION) return;

  const addColumnIfExists = async (table: string, column: string, definition: string): Promise<void> => {
    const colCheck = await queryOne<{ cid: number }>(
      `SELECT cid FROM pragma_table_info('${table}') WHERE name = '${column}'`
    );
    if (!colCheck) {
      try { await db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`); } catch { /* ignore */ }
    }
  };

  if (version < 1) {
    const tables = [
      'procedures', 'procedure_required_roles', 'procedure_safety_instructions', 'procedure_tags', 'procedure_versions',
      'approvals', 'local_tree', 'qa_registries', 'qa_pairs', 'media_items', 'media_item_tags',
      'iot_sensor_states', 'iot_actuator_states',
      'procedure_executions', 'execution_steps', 'execution_media', 'execution_completed_steps', 'execution_anomalies',
    ];
    for (const table of tables) {
      await addColumnIfExists(table, 'sync_status', `sync_status TEXT DEFAULT 'pending'`);
      await addColumnIfExists(table, 'deleted_at', `deleted_at DATETIME`);
    }
    await db.exec(`INSERT OR REPLACE INTO _schema_version (version) VALUES (1)`);
  }

  if (version < 2) {
    await addColumnIfExists('sync_logs', 'deleted_at', `deleted_at DATETIME`);
    await addColumnIfExists('sync_logs', 'sync_status', `sync_status TEXT DEFAULT 'pending'`);
    await db.exec(`INSERT OR REPLACE INTO _schema_version (version) VALUES (2)`);
  }

  if (version < 3) {
    await addColumnIfExists('sync_logs', 'status', `status TEXT DEFAULT 'pending'`);
    await db.exec(`INSERT OR REPLACE INTO _schema_version (version) VALUES (3)`);
  }

  if (version < 4) {
    // Recréer local_tree avec uuid TEXT UNIQUE pour supporter les contraintes et index
    try {
      await db.exec(`CREATE TABLE IF NOT EXISTS local_tree_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE,
        remote_id TEXT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        parent_id INTEGER,
        node_order INTEGER DEFAULT 0,
        path TEXT,
        size INTEGER DEFAULT 0,
        content TEXT,
        metadata TEXT,
        sync_status TEXT DEFAULT 'pending',
        deleted_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      await db.exec(`
        INSERT OR IGNORE INTO local_tree_new
          (uuid, remote_id, name, type, parent_id, node_order, path, size, content, sync_status, deleted_at, created_at, updated_at)
        SELECT uuid, remote_id, name, type, parent_id, node_order, path, size, content, sync_status, deleted_at, created_at, updated_at
        FROM local_tree
        WHERE uuid IS NOT NULL
      `);

      await db.exec(`DROP TABLE IF EXISTS local_tree`);
      await db.exec(`ALTER TABLE local_tree_new RENAME TO local_tree`);
      await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_local_tree_uuid ON local_tree(uuid);`);
      logger.sqlite('migration v4', { table: 'local_tree', action: 'uuid UNIQUE added, orphan rows purged' });
    } catch (e) {
      logger.sqliteError('migration v4 local_tree', e);
    }
    await db.exec(`INSERT OR REPLACE INTO _schema_version (version) VALUES (4)`);
  }

  if (version < 5) {
    await db.exec(`INSERT OR REPLACE INTO _schema_version (version) VALUES (5)`);
  }

  logger.sqlite('migration', { fromVersion: version, toVersion: SCHEMA_VERSION });
}

export const initSqlite = initSQLite;
export const getDb = (): Database | null => db;

export async function resetSQLiteDatabase(): Promise<void> {
  logger.sqlite('reset database', { started: true });

  try {
    if (db) {
      db.close();
      db = null;
    }
    initPromise = null;
    storageUsed = 'memory';

    if (typeof navigator !== 'undefined' && navigator.storage?.getDirectory) {
      try {
        const root = await navigator.storage.getDirectory();
        const filesToRemove = [
          SQLITE_CONFIG.filename,
          `${SQLITE_CONFIG.filename}-wal`,
          `${SQLITE_CONFIG.filename}-shm`,
          `${SQLITE_CONFIG.filename}-journal`,
        ];
        for (const file of filesToRemove) {
          try {
            await root.removeEntry(file);
          } catch {
          }
        }
        try {
          await root.removeEntry('nexaflow-opfs-sah');
        } catch {
        }
        logger.sqlite('reset database', { deleted: true });
      } catch {
        logger.sqlite('reset database', { deleted: false, reason: 'opfs unavailable' });
      }
    }

    if (typeof indexedDB !== 'undefined') {
      try {
        const databases = await indexedDB.databases();
        for (const dbInfo of databases) {
          const name = dbInfo.name;
          if (!name) continue;
          if (name.includes('nexaflow') || name === 'local') {
            indexedDB.deleteDatabase(name);
            logger.sqlite('reset database', { indexeddbDeleted: name });
          }
        }
      } catch {
        logger.sqlite('reset database', { indexeddbDeleted: false, reason: 'indexeddb unavailable' });
      }
    }

    logger.sqlite('reset database', { completed: true });
  } catch (error) {
    logger.sqliteError('reset database', error);
    throw error;
  }
}

export async function exec(sql: string): Promise<void> { (await initSQLite()).exec(sql); }

export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const stmt = (await initSQLite()).prepare(sql);
  try { if (params.length > 0) stmt.bind(params as BindingSpec); const r: T[] = []; while (stmt.step()) r.push(stmt.get({}) as T); return r; }
  finally { stmt.finalize(); }
}

export async function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const r = await query<T>(sql, params); return r.length > 0 ? r[0] : null;
}

export async function run(sql: string, params: unknown[] | Record<string, unknown> = []): Promise<{ changes: number; lastInsertRowid: number }> {
  const database = await initSQLite(); const stmt = database.prepare(sql);
  try {
    const p = Array.isArray(params) ? params : Object.values(params);
    if (p.length > 0) stmt.bind(p as BindingSpec);
    stmt.step();
    const idStmt = database.prepare('SELECT last_insert_rowid() as rid'); idStmt.step();
    const lastInsertRowid = Number((idStmt.get({}) as { rid: number })?.rid ?? 0); idStmt.finalize();
    return { changes: database.changes(), lastInsertRowid };
  } finally { stmt.finalize(); }
}

export { SQLITE_CONFIG, logger };
export type { SQLiteStorage };

// ==================== SYNC HELPERS ====================

export const sqliteSyncHelpers = {
  _statusColumn(table: string): string {
    return table === 'sync_logs' ? 'status' : 'sync_status';
  },

  getPendingRecords: async (db: Database, table: string): Promise<Record<string, unknown>[]> => {
    logger.sqlite('getPendingRecords', { table });
    const col = sqliteSyncHelpers._statusColumn(table);
    const stmt = db.prepare(`SELECT * FROM ${table} WHERE ${col} IN ('pending', 'local_only', 'conflict') AND deleted_at IS NULL ORDER BY updated_at DESC`);
    const results: Record<string, unknown>[] = [];
    try { while (stmt.step()) results.push(stmt.get({}) as Record<string, unknown>); } finally { stmt.finalize(); }
    return results;
  },

  markAsSynced: async (db: Database, table: string, uuid: string): Promise<void> => {
    logger.sqlite('markAsSynced', { table, uuid });
    const col = sqliteSyncHelpers._statusColumn(table);
    const stmt = db.prepare(`UPDATE ${table} SET ${col} = 'synced', updated_at = CURRENT_TIMESTAMP WHERE uuid = ?`);
    try { stmt.bind([uuid] as BindingSpec); stmt.step(); } finally { stmt.finalize(); }
  },

  softDelete: async (db: Database, table: string, uuid: string): Promise<void> => {
    logger.sqlite('softDelete', { table, uuid });
    const col = sqliteSyncHelpers._statusColumn(table);
    const stmt = db.prepare(`UPDATE ${table} SET deleted_at = CURRENT_TIMESTAMP, ${col} = 'pending', updated_at = CURRENT_TIMESTAMP WHERE uuid = ?`);
    try { stmt.bind([uuid] as BindingSpec); stmt.step(); } finally { stmt.finalize(); }
  },

  getSyncStatus: async (db: Database, table: string, uuid: string): Promise<string | null> => {
    logger.sqlite('getSyncStatus', { table, uuid });
    const col = sqliteSyncHelpers._statusColumn(table);
    const stmt = db.prepare(`SELECT ${col} FROM ${table} WHERE uuid = ?`);
    try {
      stmt.bind([uuid] as BindingSpec);
      if (stmt.step()) return (stmt.get({}) as Record<string, string>)[col];
      return null;
    } finally { stmt.finalize(); }
  },

  getPendingCount: async (db: Database, table: string): Promise<number> => {
    logger.sqlite('getPendingCount', { table });
    const col = sqliteSyncHelpers._statusColumn(table);
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE ${col} IN ('pending', 'local_only', 'conflict') AND deleted_at IS NULL`);
    try { return stmt.step() ? Number((stmt.get({}) as { count: number }).count) : 0; } finally { stmt.finalize(); }
  },
};

// ==================== GENERIC CRUD ====================

export const sqliteCrud = {
  /**
   * Crée un enregistrement dans une table
   */
  create: async <T = Record<string, unknown>>(db: Database, table: string, data: T): Promise<T | null> => {
    logger.sqlite('crud create', { table });
    const entries = Object.entries(data as Record<string, unknown>);
    const columns = entries.map(([k]) => k).join(', ');
    const placeholders = entries.map(() => '?').join(', ');
    const values = entries.map(([, v]) => v);
    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
    const stmt = db.prepare(sql);
    try { stmt.bind(values as BindingSpec); stmt.step(); return stmt.get({}) as T | null; }
    finally { stmt.finalize(); }
  },

  /**
   * Met à jour un enregistrement via son uuid
   */
  update: async <T = Record<string, unknown>>(db: Database, table: string, uuid: string, data: Partial<T>): Promise<T | null> => {
    logger.sqlite('crud update', { table, uuid });
    const entries = Object.entries(data).filter(([k]) => k !== 'uuid');
    const setClause = entries.map(([k]) => `${k} = ?`).join(', ');
    const values: unknown[] = [...entries.map(([, v]) => v), uuid];
    const sql = `UPDATE ${table} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE uuid = ? RETURNING *`;
    const stmt = db.prepare(sql);
    try { stmt.bind(values as BindingSpec); stmt.step(); return stmt.get({}) as T | null; }
    finally { stmt.finalize(); }
  },

  /**
   * Soft delete d'un enregistrement via son uuid
   */
  delete: async (db: Database, table: string, uuid: string): Promise<boolean> => {
    logger.sqlite('crud delete', { table, uuid });
    const stmt = db.prepare(`UPDATE ${table} SET deleted_at = CURRENT_TIMESTAMP, sync_status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE uuid = ?`);
    try { stmt.bind([uuid] as BindingSpec); stmt.step(); return db.changes() > 0; }
    finally { stmt.finalize(); }
  },

  /**
   * Récupère tous les enregistrements d'une table (non supprimés)
   */
  findMany: async <T = Record<string, unknown>>(db: Database, table: string, where?: Record<string, unknown>): Promise<T[]> => {
    logger.sqlite('crud findMany', { table });
    let sql = `SELECT * FROM ${table} WHERE deleted_at IS NULL`;
    const values: unknown[] = [];
    if (where) {
      const conditions = Object.entries(where).filter(([k]) => k !== 'deleted_at').map(([k, v]) => { values.push(v); return `${k} = ?`; });
      if (conditions.length > 0) sql += ' AND ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY updated_at DESC';
    const stmt = db.prepare(sql);
    try {
      if (values.length > 0) stmt.bind(values as BindingSpec);
      const results: T[] = [];
      while (stmt.step()) results.push(stmt.get({}) as T);
      return results;
    } finally { stmt.finalize(); }
  },

  /**
   * Récupère un enregistrement unique via son uuid
   */
  findUnique: async <T = Record<string, unknown>>(db: Database, table: string, uuid: string): Promise<T | null> => {
    logger.sqlite('crud findUnique', { table, uuid });
    const stmt = db.prepare(`SELECT * FROM ${table} WHERE uuid = ? AND deleted_at IS NULL`);
    try { stmt.bind([uuid] as BindingSpec); return stmt.step() ? stmt.get({}) as T : null; }
    finally { stmt.finalize(); }
  },

  /**
   * Compte les enregistrements d'une table (non supprimés)
   */
  count: async (db: Database, table: string, where?: Record<string, unknown>): Promise<number> => {
    logger.sqlite('crud count', { table });
    let sql = `SELECT COUNT(*) as count FROM ${table} WHERE deleted_at IS NULL`;
    const values: unknown[] = [];
    if (where) {
      const conditions = Object.entries(where).filter(([k]) => k !== 'deleted_at').map(([k, v]) => { values.push(v); return `${k} = ?`; });
      if (conditions.length > 0) sql += ' AND ' + conditions.join(' AND ');
    }
    const stmt = db.prepare(sql);
    try { return stmt.step() ? Number((stmt.get({}) as { count: number }).count) : 0; }
    finally { stmt.finalize(); }
  },
};

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).resetSQLite = async () => {
    console.log('[DB:SQLITE] [GLOBAL] resetting database...');
    await resetSQLiteDatabase();
    console.log('[DB:SQLITE] [GLOBAL] database reset, re-initializing...');
    const freshDb = await initSQLite();
    console.log('[DB:SQLITE] [GLOBAL] database re-initialized successfully!');
    return freshDb;
  };
  (window as unknown as Record<string, unknown>).initSQLite = initSQLite;
  console.log('[DB:SQLITE] [GLOBAL] window.resetSQLite() and window.initSQLite() are now available');
}
