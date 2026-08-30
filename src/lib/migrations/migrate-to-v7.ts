import type { Database, BindingSpec } from '@sqlite.org/sqlite-wasm';

export const NEW_SCHEMA_VERSION = 7;

export interface MigrationResult {
  success: boolean;
  migrated: number;
  skipped: number;
  errors: string[];
  rollbackAvailable: boolean;
}

export interface RollbackResult {
  success: boolean;
  restored: number;
  errors: string[];
}

export interface ValidationResult {
  valid: boolean;
  checks: Array<{ name: string; passed: boolean; detail?: string }>;
}

// ============================================================================
// SQL STATEMENTS
// ============================================================================

const SQL_CREATE_NEW_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS local_tree (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    node_type   TEXT NOT NULL CHECK (node_type IN ('root', 'directory', 'file')),
    parent_id   INTEGER REFERENCES local_tree(id) ON DELETE CASCADE,
    sort_order  INTEGER DEFAULT 0,
    path        TEXT NOT NULL UNIQUE,
    size        INTEGER DEFAULT 0,
    mime_type   TEXT,
    content     BLOB,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS qa_entries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    tree_node_id  INTEGER NOT NULL REFERENCES local_tree(id) ON DELETE CASCADE,
    question      TEXT NOT NULL,
    answer        TEXT NOT NULL,
    tags          TEXT,
    score         REAL DEFAULT 0,
    order_index   INTEGER DEFAULT 0,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS image_metadata (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    tree_node_id  INTEGER NOT NULL REFERENCES local_tree(id) ON DELETE CASCADE,
    title         TEXT,
    description   TEXT,
    category      TEXT,
    width         INTEGER,
    height        INTEGER,
    size          INTEGER,
    captured_at   INTEGER,
    geolocation   TEXT,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS technical_data (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    tree_node_id  INTEGER NOT NULL REFERENCES local_tree(id) ON DELETE CASCADE,
    data_type     TEXT NOT NULL CHECK (data_type IN ('procedure', 'config', 'report', 'log')),
    code          TEXT,
    title         TEXT,
    body          BLOB,
    version       INTEGER DEFAULT 1,
    status        TEXT,
    tags          TEXT,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS executions (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    tree_node_id            INTEGER REFERENCES local_tree(id) ON DELETE SET NULL,
    user_name               TEXT,
    phase                   TEXT CHECK (phase IN ('briefing', 'execution', 'completed', 'aborted')),
    started_at              INTEGER NOT NULL,
    finished_at             INTEGER,
    completed_steps_count   INTEGER DEFAULT 0,
    total_steps_count       INTEGER DEFAULT 0,
    anomalies               TEXT,
    created_at              INTEGER NOT NULL,
    updated_at              INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS sync_metadata (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  INTEGER NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_local_tree_parent ON local_tree(parent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_local_tree_type   ON local_tree(node_type)`,
  `CREATE INDEX IF NOT EXISTS idx_local_tree_path   ON local_tree(path)`,
  `CREATE INDEX IF NOT EXISTS idx_qa_tree_node      ON qa_entries(tree_node_id)`,
  `CREATE INDEX IF NOT EXISTS idx_qa_score         ON qa_entries(score DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_img_tree_node    ON image_metadata(tree_node_id)`,
  `CREATE INDEX IF NOT EXISTS idx_img_category     ON image_metadata(category)`,
  `CREATE INDEX IF NOT EXISTS idx_tech_tree_node   ON technical_data(tree_node_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tech_data_type   ON technical_data(data_type)`,
  `CREATE INDEX IF NOT EXISTS idx_tech_code        ON technical_data(code)`,
  `CREATE INDEX IF NOT EXISTS idx_exec_started     ON executions(started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_exec_phase       ON executions(phase)`,
];

const OLD_TABLES = [
  'procedures',
  'procedure_required_roles',
  'procedure_safety_instructions',
  'procedure_tags',
  'procedure_versions',
  'approvals',
  'local_tree',
  'qa_registries',
  'qa_pairs',
  'media_items',
  'media_item_tags',
  'sync_logs',
  'iot_sensor_states',
  'iot_actuator_states',
  'chat_sessions',
  'sensor_configs',
  'actuator_states',
  'devices',
  'iot_history',
  'vector_documents',
  'json_store',
  'sync_metadata',
  '_schema_version',
  'procedure_executions',
  'execution_steps',
  'execution_media',
  'execution_completed_steps',
  'execution_anomalies',
];

// ============================================================================
// Database helper wrappers (using passed db instance)
// ============================================================================

type SqliteRow = Record<string, unknown>;

function dbQuery(db: Database, sql: string, params: unknown[] = []): SqliteRow[] {
  const stmt = db.prepare(sql);
  const results: SqliteRow[] = [];
  try {
    if (params.length > 0) stmt.bind(params as BindingSpec);
    while (stmt.step()) {
      results.push(stmt.get({}) as SqliteRow);
    }
  } finally {
    stmt.finalize();
  }
  return results;
}

function dbQueryOne<T = SqliteRow>(db: Database, sql: string, params: unknown[] = []): T | null {
  const rows = dbQuery(db, sql, params);
  return rows.length > 0 ? (rows[0] as T) : null;
}

function dbRun(db: Database, sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number } {
  const stmt = db.prepare(sql);
  try {
    if (params.length > 0) stmt.bind(params as BindingSpec);
    stmt.step();
    const changes = db.changes();
    const idStmt = db.prepare('SELECT last_insert_rowid() as rid');
    idStmt.step();
    const row = idStmt.get({}) as { rid: number };
    idStmt.finalize();
    return { changes, lastInsertRowid: Number(row?.rid ?? 0) };
  } finally {
    stmt.finalize();
  }
}

// ============================================================================
// DATA CONVERSION HELPERS
// ============================================================================

function epochFromSqliteDate(dateStr: string | null | undefined): number {
  if (!dateStr) return Date.now();
  const parsed = Date.parse(dateStr.replace(' ', 'T') + 'Z');
  return isNaN(parsed) ? Date.now() : parsed;
}


function normalizeMimeType(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    webm: 'video/webm',
    pdf: 'application/pdf',
    txt: 'text/plain',
    csv: 'text/csv',
  };
  return map[ext || ''] ?? null;
}

function getExtensionFromMimeType(mimeType: string | null): string {
  if (!mimeType) return 'json';
  if (mimeType.startsWith('image/')) return mimeType.replace('image/', '');
  if (mimeType.startsWith('video/')) return mimeType.replace('video/', '');
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'text/plain') return 'txt';
  if (mimeType === 'text/csv') return 'csv';
  return 'json';
}

// ============================================================================
// MAIN MIGRATION
// ============================================================================

export async function migrateToV7(db: Database): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migrated: 0,
    skipped: 0,
    errors: [],
    rollbackAvailable: false,
  };

  const now = Date.now();

  try {
    db.exec('BEGIN IMMEDIATE');

    // ================================================================
    // STEP 1: Backup old tables (rename to _v6_backup)
    // ================================================================
    
    // Read schema version BEFORE renaming _schema_version
    const currentVersion = dbQueryOne<{ version: number }>(db, `SELECT version FROM _schema_version LIMIT 1`);
    
    for (const table of OLD_TABLES) {
      const exists = dbQueryOne<{ count: number }>(db,
        `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`,
        [table]
      );
      if (exists && exists.count > 0) {
        const backupName = `${table}_v6_backup`;
        db.exec(`DROP TABLE IF EXISTS ${backupName}`);
        db.exec(`ALTER TABLE ${table} RENAME TO ${backupName}`);
      }
    }

    // Archive _schema_version for rollback
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migration_meta (
        key TEXT PRIMARY KEY,
        value TEXT,
        created_at INTEGER
      )
    `);
    dbRun(db,
      `INSERT OR REPLACE INTO _migration_meta (key, value, created_at) VALUES (?, ?, ?)`,
      ['previous_schema_version', String(currentVersion?.version ?? 0), now]
    );
    result.rollbackAvailable = true;

    // ================================================================
    // STEP 2: Create new schema
    // ================================================================
    for (const sql of SQL_CREATE_NEW_SCHEMA) {
      db.exec(sql);
    }

    // ================================================================
    // STEP 3: Migrate local_tree
    // ================================================================
    const oldTreeRows = dbQuery(db, `
      SELECT id, name, type, parent_id, node_order, path, size, content, metadata, created_at, updated_at
      FROM local_tree_v6_backup
      ORDER BY id
    `);

    const usedPaths = new Set<string>();

    for (const row of oldTreeRows) {
      const nodeType = row.type === 'folder' ? 'directory' : row.type === 'root' ? 'root' : 'file';
      const mimeType = normalizeMimeType(row.name as string);
      let path = (row.path as string) || (row.name as string);

      if (usedPaths.has(path)) {
        let counter = 1;
        let uniquePath = `${path}_${counter}`;
        while (usedPaths.has(uniquePath)) {
          counter++;
          uniquePath = `${path}_${counter}`;
        }
        path = uniquePath;
      }
      usedPaths.add(path);

      dbRun(db,
        `INSERT INTO local_tree (id, name, node_type, parent_id, sort_order, path, size, mime_type, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.name,
          nodeType,
          row.parent_id,
          row.node_order ?? 0,
          path,
          row.size ?? 0,
          mimeType,
          row.content || null,
          epochFromSqliteDate(row.created_at as string),
          epochFromSqliteDate(row.updated_at as string),
        ]
      );
      result.migrated++;
    }

    // ================================================================
    // STEP 4: Migrate qa_registries + qa_pairs → qa_entries
    // ================================================================

    let qaDirId: number | null = dbQueryOne<{ id: number }>(db,
      `SELECT id FROM local_tree WHERE name = 'q-r' AND node_type = 'directory' LIMIT 1`
    )?.id ?? null;

    if (!qaDirId) {
      dbRun(db,
        `INSERT INTO local_tree (name, node_type, parent_id, sort_order, path, size, mime_type, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['q-r', 'directory', null, 1, '/q-r', 0, null, null, now, now]
      );
      qaDirId = dbQueryOne<{ last_insert_rowid: number }>(db, `SELECT last_insert_rowid() as last_insert_rowid`)?.last_insert_rowid ?? null;
    }

    // 4b: Migrate qa_pairs → qa_entries
    const oldQaPairs = dbQuery(db, `
      SELECT id, question, answer, order_idx, registry_id, created_at, updated_at
      FROM qa_pairs_v6_backup
    `);

    const registries = dbQuery(db, `SELECT id, title, description FROM qa_registries_v6_backup`);
    const registryMap = new Map(registries.map((r) => [r.id as number, r]));

    for (const pair of oldQaPairs) {
      const registry = registryMap.get(pair.registry_id as number);
      const tags = registry ? (registry.title as string) : null;

      let treeNode = dbQueryOne<{ id: number }>(db,
        `SELECT id FROM local_tree WHERE node_type = 'file' AND parent_id = ?
         AND INSTR(CAST(content AS TEXT), ?) > 0`,
        [qaDirId, (pair.question as string).substring(0, 30)]
      )?.id;

      if (!treeNode) {
        const nodeName = `qa_${pair.id}.json`;
        const filePath = `/q-r/${nodeName}`;
        dbRun(db,
          `INSERT INTO local_tree (name, node_type, parent_id, sort_order, path, size, mime_type, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nodeName, 'file', qaDirId, pair.order_idx ?? 0,
            filePath, 0, 'application/json',
            JSON.stringify({ question: pair.question, answer: pair.answer }),
            epochFromSqliteDate(pair.created_at as string),
            epochFromSqliteDate(pair.updated_at as string),
          ]
        );
        treeNode = dbQueryOne<{ id: number }>(db,
          `SELECT id FROM local_tree WHERE path = ?`,
          [filePath]
        )?.id;
      }

      if (treeNode) {
        dbRun(db,
          `INSERT INTO qa_entries (tree_node_id, question, answer, tags, score, order_index, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            treeNode,
            pair.question,
            pair.answer,
            tags,
            0,
            pair.order_idx ?? 0,
            epochFromSqliteDate(pair.created_at as string),
            epochFromSqliteDate(pair.updated_at as string),
          ]
        );
        result.migrated++;
      }
    }

    // ================================================================
    // STEP 5: Migrate media_items → image_metadata
    // ================================================================

    let imagesDirId: number | null = dbQueryOne<{ id: number }>(db,
      `SELECT id FROM local_tree WHERE name = 'images' AND node_type = 'directory' LIMIT 1`
    )?.id ?? null;

    if (!imagesDirId) {
      dbRun(db,
        `INSERT INTO local_tree (name, node_type, parent_id, sort_order, path, size, mime_type, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['images', 'directory', null, 2, '/images', 0, null, null, now, now]
      );
      imagesDirId = dbQueryOne<{ last_insert_rowid: number }>(db, `SELECT last_insert_rowid() as last_insert_rowid`)?.last_insert_rowid ?? null;
    }

    const oldMediaItems = dbQuery(db, `SELECT * FROM media_items_v6_backup`);

    const mediaTags = dbQuery(db, `SELECT media_item_id, tag FROM media_item_tags_v6_backup`);
    const tagMap = new Map<number, string[]>();
    for (const mt of mediaTags) {
      const arr = tagMap.get(mt.media_item_id as number) || [];
      arr.push(mt.tag as string);
      tagMap.set(mt.media_item_id as number, arr);
    }

    for (const item of oldMediaItems) {
      let treeNode = dbQueryOne<{ id: number }>(db,
        `SELECT id FROM local_tree WHERE name LIKE ? AND node_type = 'file' LIMIT 1`,
        [`%${item.title}%`]
      )?.id;

      if (!treeNode) {
        const ext = getExtensionFromMimeType(item.mime_type as string);
        const nodeName = `${String(item.title).replace(/\s+/g, '_')}.${ext}`;
        const filePath = `/images/${nodeName}`;
        dbRun(db,
          `INSERT INTO local_tree (name, node_type, parent_id, sort_order, path, size, mime_type, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nodeName, 'file', imagesDirId, 0,
            filePath, item.size, item.mime_type,
            item.data_url || null,
            epochFromSqliteDate(item.created_at as string),
            epochFromSqliteDate(item.updated_at as string),
          ]
        );
        treeNode = dbQueryOne<{ id: number }>(db,
          `SELECT id FROM local_tree WHERE path = ?`,
          [filePath]
        )?.id;
      }

      if (treeNode) {
        const tags = tagMap.get(item.id as number) || [];
        dbRun(db,
          `INSERT INTO image_metadata (tree_node_id, title, description, category, width, height, size, captured_at, geolocation, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            treeNode,
            item.title,
            item.description,
            item.category,
            null,
            null,
            item.size,
            null,
            item.geolocation || (tags.length > 0 ? JSON.stringify(tags) : null),
            epochFromSqliteDate(item.created_at as string),
            epochFromSqliteDate(item.updated_at as string),
          ]
        );
        result.migrated++;
      }
    }

    // ================================================================
    // STEP 6: Migrate procedures → technical_data
    // ================================================================

    let procDirId: number | null = dbQueryOne<{ id: number }>(db,
      `SELECT id FROM local_tree WHERE name = 'procedures' AND node_type = 'directory' LIMIT 1`
    )?.id ?? null;

    if (!procDirId) {
      dbRun(db,
        `INSERT INTO local_tree (name, node_type, parent_id, sort_order, path, size, mime_type, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['procedures', 'directory', null, 0, '/procedures', 0, null, null, now, now]
      );
      procDirId = dbQueryOne<{ last_insert_rowid: number }>(db, `SELECT last_insert_rowid() as last_insert_rowid`)?.last_insert_rowid ?? null;
    }

    const oldProcedures = dbQuery(db, `SELECT * FROM procedures_v6_backup`);

    const procTags = dbQuery(db, `SELECT procedure_id, tag FROM procedure_tags_v6_backup`);
    const procTagMap = new Map<number, string[]>();
    for (const pt of procTags) {
      const arr = procTagMap.get(pt.procedure_id as number) || [];
      arr.push(pt.tag as string);
      procTagMap.set(pt.procedure_id as number, arr);
    }

    const procTreeNodeMap = new Map<number, number>();

    for (const proc of oldProcedures) {
      let treeNode = dbQueryOne<{ id: number }>(db,
        `SELECT id FROM local_tree WHERE name = ? AND node_type = 'file' LIMIT 1`,
        [`${proc.code}.json`]
      )?.id;

      if (!treeNode) {
        const nodeName = `${proc.code}.json`;
        const filePath = `/procedures/${nodeName}`;
        dbRun(db,
          `INSERT INTO local_tree (name, node_type, parent_id, sort_order, path, size, mime_type, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nodeName, 'file', procDirId, 0,
            filePath, 0, 'application/json',
            proc.body || null,
            epochFromSqliteDate(proc.created_at as string),
            epochFromSqliteDate(proc.updated_at as string),
          ]
        );
        treeNode = dbQueryOne<{ id: number }>(db,
          `SELECT id FROM local_tree WHERE path = ?`,
          [filePath]
        )?.id;
      }

      if (treeNode) {
        procTreeNodeMap.set(proc.id as number, treeNode);
        const tags = procTagMap.get(proc.id as number) || [];
        const versionNum = parseInt(String(proc.version).split('.')[0] || '1', 10) || 1;
        dbRun(db,
          `INSERT INTO technical_data (tree_node_id, data_type, code, title, body, version, status, tags, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            treeNode,
            'procedure',
            proc.code,
            proc.title,
            proc.body || null,
            versionNum,
            proc.status,
            tags.join(','),
            epochFromSqliteDate(proc.created_at as string),
            epochFromSqliteDate(proc.updated_at as string),
          ]
        );
        result.migrated++;
      }
    }

    // ================================================================
    // STEP 7: Migrate procedure_executions → executions
    // ================================================================

    const oldExecutions = dbQuery(db, `SELECT * FROM procedure_executions_v6_backup`);

    for (const exec of oldExecutions) {
      const completedCountResult = dbQueryOne<{ count: number }>(db,
        `SELECT COUNT(*) as count FROM execution_completed_steps_v6_backup WHERE execution_id = ?`,
        [exec.id]
      );
      const completedCount = completedCountResult?.count ?? 0;

      const totalStepsResult = dbQueryOne<{ count: number }>(db,
        `SELECT COUNT(*) as count FROM execution_steps_v6_backup WHERE execution_id = ?`,
        [exec.id]
      );
      const totalSteps = totalStepsResult?.count ?? 0;

      const anomalies = dbQuery(db,
        `SELECT anomaly FROM execution_anomalies_v6_backup WHERE execution_id = ?`,
        [exec.id]
      );
      const anomaliesJson = anomalies.length > 0
        ? JSON.stringify(anomalies.map((a) => a.anomaly))
        : null;

      const treeNode = exec.procedure_id ? procTreeNodeMap.get(exec.procedure_id as number) : null;

      dbRun(db,
        `INSERT INTO executions (tree_node_id, user_name, phase, started_at, finished_at, completed_steps_count, total_steps_count, anomalies, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          treeNode ?? null,
          exec.user_name,
          exec.phase,
          epochFromSqliteDate(exec.started_at as string),
          exec.finished_at ? epochFromSqliteDate(exec.finished_at as string) : null,
          completedCount,
          totalSteps,
          anomaliesJson,
          epochFromSqliteDate(exec.created_at as string),
          epochFromSqliteDate(exec.updated_at as string),
        ]
      );
      result.migrated++;
    }

    // ================================================================
    // STEP 8: Migrate sync_metadata
    // ================================================================
    dbRun(db,
      `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)`,
      ['last_full_sync', now.toString(), now]
    );

    const oldSchemaVer = dbQueryOne<{ version: number }>(db, `SELECT version FROM _schema_version_v6_backup LIMIT 1`);
    if (oldSchemaVer) {
      dbRun(db,
        `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)`,
        ['previous_schema_version', String(oldSchemaVer.version), now]
      );
    }

    dbRun(db,
      `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)`,
      ['schema_version', String(NEW_SCHEMA_VERSION), now]
    );

    // ================================================================
    // STEP 9: Drop backup tables
    // ================================================================
    for (const table of OLD_TABLES) {
      const backupName = `${table}_v6_backup`;
      db.exec(`DROP TABLE IF EXISTS ${backupName}`);
    }
    db.exec(`DROP TABLE IF EXISTS _migration_meta`);
    db.exec(`DROP TABLE IF EXISTS _schema_version`);

    db.exec('COMMIT');
    result.success = true;
    result.rollbackAvailable = false;

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
    try {
      db.exec('ROLLBACK');
      result.errors.push('Migration rolled back. Old tables preserved as _v6_backup.');
    } catch {
      result.errors.push('CRITICAL: Could not rollback transaction.');
    }
  }

  return result;
}

// ============================================================================
// ROLLBACK: Restore v6 schema from backups
// ============================================================================

export async function rollbackToV6(db: Database): Promise<RollbackResult> {
  const result: RollbackResult = {
    success: false,
    restored: 0,
    errors: [],
  };

  try {
    db.exec('BEGIN IMMEDIATE');

    const newTables = [
      'executions', 'technical_data', 'image_metadata',
      'qa_entries', 'local_tree', 'sync_metadata',
    ];
    for (const table of newTables) {
      db.exec(`DROP TABLE IF EXISTS ${table}`);
    }

    const backupTables = dbQuery(db,
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_v6_backup' ORDER BY name`
    );

    for (const { name } of backupTables) {
      const originalName = (name as string).replace(/_v6_backup$/, '');
      db.exec(`DROP TABLE IF EXISTS ${originalName}`);
      db.exec(`ALTER TABLE ${name} RENAME TO ${originalName}`);
      result.restored++;
    }

    const prevVersionRow = dbQueryOne<{ value: string }>(db,
      `SELECT value FROM _migration_meta WHERE key = 'previous_schema_version'`
    );
    if (prevVersionRow) {
      db.exec(`CREATE TABLE IF NOT EXISTS _schema_version (version INTEGER PRIMARY KEY)`);
      dbRun(db, `INSERT OR REPLACE INTO _schema_version (version) VALUES (?)`, [parseInt(prevVersionRow.value, 10)]);
    }

    db.exec(`DROP TABLE IF EXISTS _migration_meta`);
    db.exec('COMMIT');
    result.success = true;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
  }

  return result;
}

// ============================================================================
// VALIDATION
// ============================================================================

export async function validateMigration(db: Database): Promise<ValidationResult> {
  const checks: Array<{ name: string; passed: boolean; detail?: string }> = [];

  // Check 1: Schema version
  try {
    const ver = dbQueryOne<{ value: string }>(db, `SELECT value FROM sync_metadata WHERE key = 'schema_version'`);
    checks.push({
      name: 'Schema version',
      passed: ver?.value === String(NEW_SCHEMA_VERSION),
      detail: `Expected v${NEW_SCHEMA_VERSION}, got ${ver?.value ?? 'none'}`,
    });
  } catch {
    checks.push({ name: 'Schema version', passed: false, detail: 'sync_metadata table missing' });
  }

  // Check 2: local_tree migrated
  try {
    const treeCount = dbQueryOne<{ count: number }>(db, `SELECT COUNT(*) as count FROM local_tree`);
    const hasNewCols = dbQueryOne<{ cid: number }>(db, `SELECT cid FROM pragma_table_info('local_tree') WHERE name = 'node_type'`);
    const oldCols = dbQueryOne<{ cid: number }>(db, `SELECT cid FROM pragma_table_info('local_tree') WHERE name = 'sync_status'`);
    checks.push({
      name: 'local_tree migrated',
      passed: treeCount !== null && !!hasNewCols && !oldCols,
      detail: `${treeCount?.count ?? 0} nodes, node_type=${!!hasNewCols}, sync_status removed=${!oldCols}`,
    });
  } catch (e) {
    checks.push({ name: 'local_tree migrated', passed: false, detail: e instanceof Error ? e.message : String(e) });
  }

  // Check 3: qa_entries
  try {
    const qaCount = dbQueryOne<{ count: number }>(db, `SELECT COUNT(*) as count FROM qa_entries`);
    const hasFk = dbQueryOne<{ sql: string }>(db, `SELECT sql FROM sqlite_master WHERE type='table' AND name='qa_entries'`);
    checks.push({
      name: 'qa_entries migrated',
      passed: qaCount !== null && !!hasFk?.sql?.includes('tree_node_id'),
      detail: `${qaCount?.count ?? 0} entries, FK=${!!hasFk?.sql?.includes('tree_node_id')}`,
    });
  } catch (e) {
    checks.push({ name: 'qa_entries migrated', passed: false, detail: e instanceof Error ? e.message : String(e) });
  }

  // Check 4: image_metadata
  try {
    const imgCount = dbQueryOne<{ count: number }>(db, `SELECT COUNT(*) as count FROM image_metadata`);
    checks.push({
      name: 'image_metadata migrated',
      passed: imgCount !== null,
      detail: `${imgCount?.count ?? 0} images`,
    });
  } catch (e) {
    checks.push({ name: 'image_metadata migrated', passed: false, detail: e instanceof Error ? e.message : String(e) });
  }

  // Check 5: technical_data
  try {
    const tdCount = dbQueryOne<{ count: number }>(db, `SELECT COUNT(*) as count FROM technical_data`);
    const procCount = dbQueryOne<{ count: number }>(db, `SELECT COUNT(*) as count FROM technical_data WHERE data_type = 'procedure'`);
    checks.push({
      name: 'technical_data migrated',
      passed: tdCount !== null && procCount !== null,
      detail: `${tdCount?.count ?? 0} total, ${procCount?.count ?? 0} procedures`,
    });
  } catch (e) {
    checks.push({ name: 'technical_data migrated', passed: false, detail: e instanceof Error ? e.message : String(e) });
  }

  // Check 6: executions
  try {
    const execCount = dbQueryOne<{ count: number }>(db, `SELECT COUNT(*) as count FROM executions`);
    checks.push({
      name: 'executions migrated',
      passed: execCount !== null,
      detail: `${execCount?.count ?? 0} executions`,
    });
  } catch (e) {
    checks.push({ name: 'executions migrated', passed: false, detail: e instanceof Error ? e.message : String(e) });
  }

  // Check 7: Old columns removed
  try {
    const oldColCount = dbQueryOne<{ count: number }>(db,
      `SELECT COUNT(*) as count FROM pragma_table_info('local_tree') WHERE name IN ('sync_status', 'deleted_at', 'uuid', 'remote_id')`
    );
    const qaOldCols = dbQueryOne<{ count: number }>(db,
      `SELECT COUNT(*) as count FROM pragma_table_info('qa_entries') WHERE name IN ('sync_status', 'deleted_at', 'uuid')`
    );
    checks.push({
      name: 'Old columns removed',
      passed: (oldColCount?.count ?? -1) === 0 && (qaOldCols?.count ?? -1) === 0,
      detail: `local_tree old: ${oldColCount?.count ?? 0}, qa_entries old: ${qaOldCols?.count ?? 0}`,
    });
  } catch (e) {
    checks.push({ name: 'Old columns removed', passed: false, detail: e instanceof Error ? e.message : String(e) });
  }

  // Check 8: Backup tables cleaned
  try {
    const backupTables = dbQuery(db,
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_v6_backup'`
    );
    checks.push({
      name: 'Backup tables cleaned',
      passed: backupTables.length === 0,
      detail: `${backupTables.length} backup tables remaining`,
    });
  } catch (e) {
    checks.push({ name: 'Backup tables cleaned', passed: false, detail: e instanceof Error ? e.message : String(e) });
  }

  // Check 9: Referential integrity
  try {
    const orphanedQa = dbQueryOne<{ count: number }>(db,
      `SELECT COUNT(*) as count FROM qa_entries q LEFT JOIN local_tree t ON q.tree_node_id = t.id WHERE t.id IS NULL`
    );
    const orphanedImg = dbQueryOne<{ count: number }>(db,
      `SELECT COUNT(*) as count FROM image_metadata i LEFT JOIN local_tree t ON i.tree_node_id = t.id WHERE t.id IS NULL`
    );
    const orphanedTech = dbQueryOne<{ count: number }>(db,
      `SELECT COUNT(*) as count FROM technical_data t LEFT JOIN local_tree lt ON t.tree_node_id = lt.id WHERE lt.id IS NULL`
    );
    checks.push({
      name: 'Referential integrity',
      passed: (orphanedQa?.count ?? 1) === 0 && (orphanedImg?.count ?? 1) === 0 && (orphanedTech?.count ?? 1) === 0,
      detail: `orphans - qa:${orphanedQa?.count ?? 0}, img:${orphanedImg?.count ?? 0}, tech:${orphanedTech?.count ?? 0}`,
    });
  } catch (e) {
    checks.push({ name: 'Referential integrity', passed: false, detail: e instanceof Error ? e.message : String(e) });
  }

  // Check 10: Indexes present
  try {
    const indexes = dbQuery(db, `SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'`);
    checks.push({
      name: 'Indexes created',
      passed: indexes.length >= 8,
      detail: `${indexes.length} indexes found`,
    });
  } catch (e) {
    checks.push({ name: 'Indexes created', passed: false, detail: e instanceof Error ? e.message : String(e) });
  }

  const valid = checks.every((c) => c.passed);
  return { valid, checks };
}

// ============================================================================
// EXPORTED HELPER: Run migration end-to-end
// ============================================================================

export async function runMigrationV7(): Promise<{
  result: MigrationResult;
  validation: ValidationResult;
}> {
  const mod = await import('@/lib/client-engine/sqlite');
  const db = mod.getDb();
  if (!db) {
    throw new Error('SQLite database not initialized. Call initSQLite() first.');
  }

  const result = await migrateToV7(db);

  if (result.success) {
    const validation = await validateMigration(db);
    return { result, validation };
  }

  return { result, validation: { valid: false, checks: [] } };
}


