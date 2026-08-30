async function test() {
  const mod = await import('@sqlite.org/sqlite-wasm');
  const s3 = await mod.default({
    print: (m) => console.log('[print]', m),
    printErr: (m) => console.error('[printErr]', m),
  });

  const db = new s3.oo1.DB('test-migration-debug');
  
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
    try {
      db.exec(sql);
    } catch (e) {
      console.error('Error creating table:', e.message);
    }
  }
  db.exec(`INSERT INTO _schema_version (version) VALUES (6)`);

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  db.exec(`
    INSERT INTO local_tree (name, type, path, created_at, updated_at) VALUES
    ('root','root','/root','${now}','${now}'),
    ('procedures','directory','/p','${now}','${now}'),
    ('q-r','directory','/q','${now}','${now}'),
    ('PROC-001.json','file','/p/PROC-001.json','${now}','${now}');
    INSERT INTO qa_registries (title) VALUES ('Securite');
    INSERT INTO qa_pairs (question, answer, order_idx, registry_id) VALUES ('Q1','A1',0,1);
    INSERT INTO media_items (title, description, category, kind, mime_type, size, data_url, created_at, updated_at) VALUES ('Img1','Desc','cat','image','image/png',100,'data','${now}','${now}');
    INSERT INTO media_item_tags (media_item_id, tag) VALUES (1,'urgent');
    INSERT INTO procedures (code, title, body, version, status, created_at, updated_at) VALUES ('PROC-001','Title','{}','1.0','active','${now}','${now}');
    INSERT INTO procedure_tags (procedure_id, tag) VALUES (1,'tag1');
    INSERT INTO procedure_executions (procedure_id, user_name, phase, started_at) VALUES (1,'John','completed','${now}');
    INSERT INTO execution_anomalies (execution_id, anomaly) VALUES (1,'Anomaly text');
    INSERT INTO execution_steps (execution_id, step_id, is_completed) VALUES (1,'s1',1);
    INSERT INTO execution_completed_steps (execution_id, step_id) VALUES (1,'s1');
    INSERT INTO procedure_required_roles (procedure_id, role) VALUES (1,'rondier');
    INSERT INTO procedure_safety_instructions (procedure_id, instruction) VALUES (1,'Instruction');
  `);

  // Inline the migration code to debug
  const OLD_TABLES = [
    'procedures', 'procedure_required_roles', 'procedure_safety_instructions',
    'procedure_tags', 'procedure_versions', 'approvals', 'local_tree',
    'qa_registries', 'qa_pairs', 'media_items', 'media_item_tags',
    'sync_logs', 'iot_sensor_states', 'iot_actuator_states', 'chat_sessions',
    'sensor_configs', 'actuator_states', 'devices', 'iot_history',
    'vector_documents', 'json_store', 'sync_metadata', '_schema_version',
    'procedure_executions', 'execution_steps', 'execution_media',
    'execution_completed_steps', 'execution_anomalies',
  ];

  const SQL_CREATE_NEW_SCHEMA = [
    `CREATE TABLE IF NOT EXISTS local_tree (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      node_type TEXT NOT NULL CHECK (node_type IN ('root', 'directory', 'file')),
      parent_id INTEGER REFERENCES local_tree(id) ON DELETE CASCADE,
      sort_order INTEGER DEFAULT 0,
      path TEXT NOT NULL UNIQUE,
      size INTEGER DEFAULT 0,
      mime_type TEXT,
      content BLOB,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS qa_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tree_node_id INTEGER NOT NULL REFERENCES local_tree(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      tags TEXT,
      score REAL DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS image_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tree_node_id INTEGER NOT NULL REFERENCES local_tree(id) ON DELETE CASCADE,
      title TEXT,
      description TEXT,
      category TEXT,
      width INTEGER,
      height INTEGER,
      size INTEGER,
      captured_at INTEGER,
      geolocation TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS technical_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tree_node_id INTEGER NOT NULL REFERENCES local_tree(id) ON DELETE CASCADE,
      data_type TEXT NOT NULL CHECK (data_type IN ('procedure', 'config', 'report', 'log')),
      code TEXT,
      title TEXT,
      body BLOB,
      version INTEGER DEFAULT 1,
      status TEXT,
      tags TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tree_node_id INTEGER REFERENCES local_tree(id) ON DELETE SET NULL,
      user_name TEXT,
      phase TEXT CHECK (phase IN ('briefing', 'execution', 'completed', 'aborted')),
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      completed_steps_count INTEGER DEFAULT 0,
      total_steps_count INTEGER DEFAULT 0,
      anomalies TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_local_tree_parent ON local_tree(parent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_local_tree_type ON local_tree(node_type)`,
    `CREATE INDEX IF NOT EXISTS idx_local_tree_path ON local_tree(path)`,
    `CREATE INDEX IF NOT EXISTS idx_qa_tree_node ON qa_entries(tree_node_id)`,
    `CREATE INDEX IF NOT EXISTS idx_qa_score ON qa_entries(score DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_img_tree_node ON image_metadata(tree_node_id)`,
    `CREATE INDEX IF NOT EXISTS idx_img_category ON image_metadata(category)`,
    `CREATE INDEX IF NOT EXISTS idx_tech_tree_node ON technical_data(tree_node_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tech_data_type ON technical_data(data_type)`,
    `CREATE INDEX IF NOT EXISTS idx_tech_code ON technical_data(code)`,
    `CREATE INDEX IF NOT EXISTS idx_exec_started ON executions(started_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_exec_phase ON executions(phase)`,
  ];

  console.log('Starting migration...');
  
  try {
    db.exec('BEGIN IMMEDIATE');
    
    for (const table of OLD_TABLES) {
      const exists = db.exec(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='${table}'`);
      // Can't get result from exec, use prepare
      const stmt = db.prepare(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`);
      stmt.bind([table]);
      const row = stmt.step() ? stmt.get({}) : { count: 0 };
      stmt.finalize();
      if (row.count > 0) {
        const backupName = `${table}_v6_backup`;
        db.exec(`DROP TABLE IF EXISTS ${backupName}`);
        db.exec(`ALTER TABLE ${table} RENAME TO ${backupName}`);
        console.log(`Renamed ${table} -> ${backupName}`);
      }
    }

    const currentVersionStmt = db.prepare(`SELECT version FROM _schema_version LIMIT 1`);
    const currentVersion = currentVersionStmt.step() ? currentVersionStmt.get({}) : { version: 0 };
    currentVersionStmt.finalize();
    console.log('Current version:', currentVersion.version);

    db.exec(`
      CREATE TABLE IF NOT EXISTS _migration_meta (
        key TEXT PRIMARY KEY,
        value TEXT,
        created_at INTEGER
      )
    `);
    
    const now = Date.now();
    const insertMeta = db.prepare(`INSERT OR REPLACE INTO _migration_meta (key, value, created_at) VALUES (?, ?, ?)`);
    insertMeta.bind(['previous_schema_version', String(currentVersion.version ?? 0), now]);
    insertMeta.step();
    insertMeta.finalize();

    for (const sql of SQL_CREATE_NEW_SCHEMA) {
      db.exec(sql);
    }
    
    console.log('New schema created');

    // Migrate local_tree
    const oldTreeRows = [];
    const treeStmt = db.prepare(`SELECT id, name, type, parent_id, node_order, path, size, content, metadata, created_at, updated_at FROM local_tree_v6_backup ORDER BY id`);
    while (treeStmt.step()) {
      oldTreeRows.push(treeStmt.get({}));
    }
    treeStmt.finalize();
    console.log('Old tree rows:', oldTreeRows.length);

    for (const row of oldTreeRows) {
      const nodeType = row.type === 'folder' ? 'directory' : row.type === 'root' ? 'root' : 'file';
      const path = row.path || row.name;
      const insertTree = db.prepare(`INSERT INTO local_tree (id, name, node_type, parent_id, sort_order, path, size, mime_type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      insertTree.bind([row.id, row.name, nodeType, row.parent_id, row.node_order ?? 0, path, row.size ?? 0, null, row.content ? Buffer.from(row.content) : null, Date.parse(row.created_at.replace(' ', 'T') + 'Z') || Date.now(), Date.parse(row.updated_at.replace(' ', 'T') + 'Z') || Date.now()]);
      insertTree.step();
      insertTree.finalize();
    }
    console.log('Local tree migrated');

    db.exec('COMMIT');
    console.log('Migration SUCCESS');
  } catch (e) {
    console.error('Migration FAILED:', e.message);
    try { db.exec('ROLLBACK'); } catch {}
  }

  db.close();
}

test().catch(console.error);
