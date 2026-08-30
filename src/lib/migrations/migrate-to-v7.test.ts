import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';

let dbCounter = 0;
let sqlite3Static: any;
let db: any;

// ============================================================================
// Shared helpers
// ============================================================================

function stmtGet(stmt: any): any {
  stmt.step();
  return stmt.get({});
}

function stmtAll(stmt: any): any[] {
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.get({}));
  }
  return results;
}

async function createV6Schema(database: any): Promise<void> {
  const tables = [
    `CREATE TABLE local_tree (
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
    )`,
    `CREATE TABLE qa_registries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      sync_status TEXT DEFAULT 'pending',
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE qa_pairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      order_idx INTEGER DEFAULT 0,
      registry_id INTEGER REFERENCES qa_registries(id),
      sync_status TEXT DEFAULT 'pending',
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE media_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      kind TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      data_url TEXT NOT NULL,
      thumbnail_data_url TEXT,
      geolocation TEXT,
      sync_status TEXT DEFAULT 'pending',
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE media_item_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      media_item_id INTEGER REFERENCES media_items(id),
      tag TEXT NOT NULL,
      sync_status TEXT DEFAULT 'pending',
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE procedures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      priority TEXT DEFAULT 'moyenne',
      estimated_time_minutes INTEGER DEFAULT 1,
      status TEXT DEFAULT 'draft',
      author_id TEXT,
      author_name TEXT,
      approver_id TEXT,
      approver_name TEXT,
      review_date DATETIME,
      version TEXT DEFAULT '1.0',
      language TEXT DEFAULT 'fr-FR',
      body JSON,
      sync_status TEXT DEFAULT 'pending',
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE procedure_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT,
      procedure_id INTEGER REFERENCES procedures(id),
      tag TEXT,
      sync_status TEXT DEFAULT 'pending',
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE procedure_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      procedure_id INTEGER REFERENCES procedures(id),
      user_id TEXT,
      user_name TEXT,
      user_role TEXT,
      phase TEXT DEFAULT 'briefing',
      current_step_index INTEGER DEFAULT 0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME,
      global_elapsed INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'pending',
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE execution_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      execution_id INTEGER REFERENCES procedure_executions(id),
      step_id TEXT,
      step_order INTEGER,
      title TEXT,
      type TEXT,
      is_mandatory INTEGER DEFAULT 0,
      is_completed INTEGER DEFAULT 0,
      timer_enabled INTEGER DEFAULT 0,
      timer_seconds INTEGER DEFAULT 0,
      started_at DATETIME,
      finished_at DATETIME,
      anomaly TEXT,
      sync_status TEXT DEFAULT 'pending',
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE execution_anomalies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT,
      execution_id INTEGER REFERENCES procedure_executions(id),
      anomaly TEXT NOT NULL,
      sync_status TEXT DEFAULT 'pending',
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE execution_completed_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT,
      execution_id INTEGER REFERENCES procedure_executions(id),
      step_id TEXT NOT NULL,
      sync_status TEXT DEFAULT 'pending',
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE procedure_required_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT,
      procedure_id INTEGER REFERENCES procedures(id),
      role TEXT,
      sync_status TEXT DEFAULT 'pending',
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE procedure_safety_instructions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT,
      procedure_id INTEGER REFERENCES procedures(id),
      instruction TEXT,
      sync_status TEXT DEFAULT 'pending',
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      model_name TEXT,
      record_id TEXT,
      record_uuid TEXT,
      operation TEXT,
      status TEXT DEFAULT 'pending',
      deleted_at DATETIME,
      synced_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE _schema_version (version INTEGER PRIMARY KEY)`,
  ];
  for (const sql of tables) {
    database.exec(sql);
  }
  database.exec(`INSERT INTO _schema_version (version) VALUES (6)`);
}

async function seedV6Data(database: any): Promise<void> {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  database.exec(`
    INSERT INTO local_tree (name, type, parent_id, node_order, path, content, created_at, updated_at) VALUES
    ('root', 'root', NULL, 0, '/root', NULL, '${now}', '${now}'),
    ('procedures', 'directory', 1, 1, '/root/procedures', NULL, '${now}', '${now}'),
    ('q-r', 'directory', 1, 2, '/root/q-r', NULL, '${now}', '${now}'),
    ('images', 'directory', 1, 3, '/root/images', NULL, '${now}', '${now}'),
    ('PROC-SEC-001.json', 'file', 2, 0, '/root/procedures/PROC-SEC-001.json',
     '{"question":"Securite?","answer":"Port detecteur"}', '${now}', '${now}'),
    ('faq.json', 'file', 3, 0, '/root/q-r/faq.json',
     '{"registry":"faq","pairs":[{"question":"Qui?","answer":"Admin"}]}', '${now}', '${now}'),
    ('logo.png', 'file', 4, 0, '/root/images/logo.png',
     'base64imagedata', '${now}', '${now}');
  `);

  database.exec(`
    INSERT INTO qa_registries (title, description, created_at, updated_at) VALUES
    ('Securite', 'Questions securite', '${now}', '${now}'),
    ('Procedure FAQ', 'FAQ procedures', '${now}', '${now}');
    INSERT INTO qa_pairs (question, answer, order_idx, registry_id, created_at, updated_at) VALUES
    ('Quelle est la température maximale?', '85°C', 0, 1, '${now}', '${now}'),
    ('Quel PPE faut-il porter?', 'Casque, gilet haute visibilité', 1, 1, '${now}', '${now}'),
    ('Comment signaler une alerte?', 'Via le bouton alerte sur le terminal', 0, 2, '${now}', '${now}');
  `);

  database.exec(`
    INSERT INTO procedures (code, title, category, status, version, body, created_at, updated_at) VALUES
    ('PROC-001', 'Procedure Securite Incendrie', 'securite', 'active', '1.0',
     '{"steps":[{"id":"s1","title":"Alarme"},{"id":"s2","title":"Evacuation"}]}', '${now}', '${now}');
    INSERT INTO procedure_tags (procedure_id, tag) VALUES
    (1, 'urgence'), (1, 'feu'), (1, 'evacuation');
  `);

  database.exec(`
    INSERT INTO media_items (title, category, kind, mime_type, size, data_url) VALUES
    ('Photo Panne', 'inspection', 'image', 'image/png', 102400, 'base64data'),
    ('Plan Centrale', 'procedure', 'image', 'image/jpeg', 204800, 'base64data2');
    INSERT INTO media_item_tags (media_item_id, tag) VALUES
    (1, 'urgent'), (1, 'electrique');
  `);

  database.exec(`
    INSERT INTO procedure_executions (procedure_id, user_name, phase, started_at, finished_at, created_at, updated_at) VALUES
    (1, 'Jean Dupont', 'completed', '${now}', '${now}', '${now}', '${now}');
    INSERT INTO execution_anomalies (execution_id, anomaly) VALUES
    (1, 'Alerte fumée capteur 3 défaillant');
    INSERT INTO execution_steps (execution_id, step_id, title, is_completed) VALUES
    (1, 's1', 'Alarme', 1), (1, 's2', 'Evacuation', 0);
    INSERT INTO execution_completed_steps (execution_id, step_id) VALUES
    (1, 's1');
  `);

  database.exec(`
    INSERT INTO procedure_required_roles (procedure_id, role) VALUES
    (1, 'rondier'), (1, 'chef_de_quart');
    INSERT INTO procedure_safety_instructions (procedure_id, instruction) VALUES
    (1, 'Verifier alerte avant entree');
  `);
}

// ============================================================================
// TESTS
// ============================================================================

beforeAll(async () => {
  const mod = await import('@sqlite.org/sqlite-wasm');
  sqlite3Static = await mod.default({
    print: () => {},
    printErr: () => {},
  });
}, 30000);

// ========================================================================
// Migration execution tests
// ========================================================================

describe('Migration v6 → v7', () => {
  let migrate: typeof import('@/lib/migrations/migrate-to-v7');

  beforeAll(async () => {
    migrate = await import('@/lib/migrations/migrate-to-v7');
  });

  beforeEach(async () => {
    db = new sqlite3Static.oo1.DB(`test-migration-${++dbCounter}`);
    await createV6Schema(db);
    await seedV6Data(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should successfully migrate from v6 to v7', async () => {
    const result = await migrate.migrateToV7(db);

    if (!result.success) {
      console.error('Migration errors:', result.errors);
    }
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.migrated).toBeGreaterThan(0);
  });

  it('should create exactly 6 new tables', async () => {
    await migrate.migrateToV7(db);

    const stmt = db.prepare(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name IN ('local_tree', 'qa_entries', 'image_metadata', 'technical_data', 'executions', 'sync_metadata')`
    );
    const tableCount = stmtGet(stmt);
    expect(tableCount.count).toBe(6);
  });

  it('should remove sync_status and deleted_at columns', async () => {
    await migrate.migrateToV7(db);

    const stmt = db.prepare(`PRAGMA table_info('local_tree')`);
    const cols = stmtAll(stmt);
    const colNames = cols.map((c: any) => c.name);
    expect(colNames).not.toContain('sync_status');
    expect(colNames).not.toContain('deleted_at');
    expect(colNames).not.toContain('uuid');
    expect(colNames).not.toContain('remote_id');
  });

  it('should remove old tables entirely', async () => {
    await migrate.migrateToV7(db);

    const stmt = db.prepare(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name IN ('sync_logs', 'chat_sessions', 'devices', 'iot_history')`
    );
    const oldTables = stmtGet(stmt);
    expect(oldTables.count).toBe(0);
  });
});

// ========================================================================
// Data integrity tests
// ========================================================================

describe('Migration data integrity', () => {
  let migrate: typeof import('@/lib/migrations/migrate-to-v7');

  beforeAll(async () => {
    migrate = await import('@/lib/migrations/migrate-to-v7');
  });

  beforeEach(async () => {
    db = new sqlite3Static.oo1.DB(`test-integrity-${++dbCounter}`);
    await createV6Schema(db);
    await seedV6Data(db);
    await migrate.migrateToV7(db);
  });

  afterEach(() => db.close());

  it('should preserve all QA pairs with correct question/answer', async () => {
    const stmt = db.prepare(`SELECT question, answer FROM qa_entries`);
    const rows = stmtAll(stmt);
    expect(rows.length).toBe(1);
    expect(rows[0].question).toBe('Q1');
    expect(rows[0].answer).toBe('A1');
  });

  it('should link qa_entries to local_tree via tree_node_id', async () => {
    const stmt = db.prepare(`
      SELECT q.question, lt.path
      FROM qa_entries q
      JOIN local_tree lt ON q.tree_node_id = lt.id
    `);
    const row = stmtAll(stmt);
    expect(row.length).toBe(1);
    expect(row[0].path).toContain('q-r');
  });

  it('should preserve all media items with metadata', async () => {
    const stmt = db.prepare(`SELECT title, description, category FROM image_metadata`);
    const rows = stmtAll(stmt);
    expect(rows.length).toBe(1);
    expect(rows[0].title).toBe('Img1');
    expect(rows[0].category).toBe('cat');
  });

  it('should preserve all procedures in technical_data', async () => {
    const stmt = db.prepare(`SELECT code, title, data_type FROM technical_data`);
    const rows = stmtAll(stmt);
    expect(rows.length).toBe(1);
    expect(rows[0].code).toBe('PROC-001');
    expect(rows[0].data_type).toBe('procedure');
  });

  it('should preserve execution data with step counts', async () => {
    const stmt = db.prepare(`
      SELECT user_name, phase, completed_steps_count, total_steps_count
      FROM executions
    `);
    const row = stmtGet(stmt);
    expect(row.user_name).toBe('John');
    expect(row.phase).toBe('completed');
    expect(row.completed_steps_count).toBe(1);
    expect(row.total_steps_count).toBe(1);
  });

  it('should store anomalies as JSON in executions', async () => {
    const stmt = db.prepare(`SELECT anomalies FROM executions`);
    const row = stmtGet(stmt);
    expect(row.anomalies).toBeDefined();
    const parsed = JSON.parse(row.anomalies);
    expect(parsed).toContain('Anomaly text');
  });

  it('should record schema_version in sync_metadata', async () => {
    const stmt = db.prepare(`SELECT value FROM sync_metadata WHERE key = 'schema_version'`);
    const row = stmtGet(stmt);
    expect(row.value).toBe('7');
  });
});

// ========================================================================
// Validation tests
// ========================================================================

describe('Migration validation', () => {
  let migrate: typeof import('@/lib/migrations/migrate-to-v7');

  beforeAll(async () => {
    migrate = await import('@/lib/migrations/migrate-to-v7');
  });

  beforeEach(async () => {
    db = new sqlite3Static.oo1.DB(`test-validation-${++dbCounter}`);
    await createMinimalV6(db);
    const result = await migrate.migrateToV7(db);
    if (!result.success) {
      console.error('Validation beforeEach migration errors:', result.errors);
    }
  });

  afterEach(() => db.close());

  async function createMinimalV6(database: any): Promise<void> {
    database.exec(`
      CREATE TABLE local_tree (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type TEXT, parent_id INTEGER,
        node_order INTEGER, path TEXT, size INTEGER, content TEXT, metadata TEXT,
        sync_status TEXT, deleted_at DATETIME, created_at DATETIME, updated_at DATETIME,
        uuid TEXT, remote_id TEXT
      );
      CREATE TABLE qa_registries (id INTEGER PRIMARY KEY, title TEXT);
      CREATE TABLE qa_pairs (id INTEGER PRIMARY KEY, question TEXT, answer TEXT, order_idx INTEGER, registry_id INTEGER);
      CREATE TABLE procedures (id INTEGER PRIMARY KEY, code TEXT, title TEXT, category TEXT, body TEXT, version TEXT, status TEXT, created_at DATETIME, updated_at DATETIME);
      CREATE TABLE procedure_tags (procedure_id INTEGER, tag TEXT);
      CREATE TABLE procedure_executions (id INTEGER PRIMARY KEY, procedure_id INTEGER, user_name TEXT, phase TEXT, started_at DATETIME, finished_at DATETIME);
      CREATE TABLE execution_anomalies (execution_id INTEGER, anomaly TEXT);
      CREATE TABLE execution_steps (execution_id INTEGER, step_id TEXT, is_completed INTEGER);
      CREATE TABLE execution_completed_steps (execution_id INTEGER, step_id TEXT);
      CREATE TABLE media_items (id INTEGER PRIMARY KEY, title TEXT, category TEXT, kind TEXT, mime_type TEXT, size INTEGER, data_url TEXT, created_at DATETIME, updated_at DATETIME);
      CREATE TABLE media_item_tags (media_item_id INTEGER, tag TEXT);
      CREATE TABLE _schema_version (version INTEGER PRIMARY KEY);
      CREATE TABLE sync_logs (id INTEGER PRIMARY KEY);
    `);
    database.exec(`INSERT INTO _schema_version VALUES (6);`);

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    database.exec(`
      INSERT INTO local_tree (name, type, path, created_at, updated_at) VALUES ('root','root','/root','${now}','${now}');
      INSERT INTO qa_registries (title) VALUES ('Test');
      INSERT INTO qa_pairs (question, answer, order_idx, registry_id) VALUES ('Q','A',0,1);
      INSERT INTO procedures (code, title, category, body, version, status, created_at, updated_at) VALUES ('P1','Proc','securite','{}','1.0','active','${now}','${now}');
      INSERT INTO media_items (title, category, kind, mime_type, size, data_url, created_at, updated_at) VALUES ('M1','cat1','image','image/png',100,'data','${now}','${now}');
      INSERT INTO procedure_executions (procedure_id, user_name, phase, started_at) VALUES (1,'User','execution','${now}');
    `);
  }

  it('should pass all validation checks', async () => {
    const result = await migrate.validateMigration(db);
    if (!result.valid) {
      console.error('Validation checks:', result.checks);
    }
    expect(result.valid).toBe(true);
    expect(result.checks.length).toBe(10);
  });

  it('should detect missing schema_version in sync_metadata', async () => {
    db.exec(`DELETE FROM sync_metadata WHERE key = 'schema_version'`);
    const result = await migrate.validateMigration(db);
    const check = result.checks.find((c: any) => c.name === 'Schema version');
    expect(check?.passed).toBe(false);
  });

  it('should detect orphaned tree_node_id references', async () => {
    db.exec(`INSERT INTO qa_entries (tree_node_id, question, answer, created_at, updated_at) VALUES (99999, 'Orphan', 'Q', 1, 1)`);
    const result = await migrate.validateMigration(db);
    const check = result.checks.find((c: any) => c.name === 'Referential integrity');
    expect(check?.passed).toBe(false);
  });

  it('should fail validation when backup tables remain', async () => {
    db.exec(`CREATE TABLE qa_pairs_v6_backup (id INTEGER PRIMARY KEY)`);
    const result = await migrate.validateMigration(db);
    const check = result.checks.find((c: any) => c.name === 'Backup tables cleaned');
    expect(check?.passed).toBe(false);
  });
});
