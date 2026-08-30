-- Migration SQLite v6 -> v7 (Étape 1: Schéma optimisé)
-- Date: 2026-08-29
-- Drop old tables + Create new 6-table schema

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- ================================================================
-- DROP OLD TABLES
-- ================================================================
DROP TABLE IF EXISTS procedure_required_roles;
DROP TABLE IF EXISTS procedure_safety_instructions;
DROP TABLE IF EXISTS procedure_tags;
DROP TABLE IF EXISTS procedure_versions;
DROP TABLE IF EXISTS approvals;
DROP TABLE IF EXISTS procedure_executions;
DROP TABLE IF EXISTS execution_steps;
DROP TABLE IF EXISTS execution_media;
DROP TABLE IF EXISTS execution_completed_steps;
DROP TABLE IF EXISTS execution_anomalies;
DROP TABLE IF EXISTS procedures;
DROP TABLE IF EXISTS qa_registries;
DROP TABLE IF EXISTS qa_pairs;
DROP TABLE IF EXISTS media_items;
DROP TABLE IF EXISTS media_item_tags;
DROP TABLE IF EXISTS local_tree;
DROP TABLE IF EXISTS sync_logs;
DROP TABLE IF EXISTS iot_sensor_states;
DROP TABLE IF EXISTS iot_actuator_states;
DROP TABLE IF EXISTS chat_sessions;
DROP TABLE IF EXISTS sensor_configs;
DROP TABLE IF EXISTS actuator_states;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS iot_history;
DROP TABLE IF EXISTS vector_documents;
DROP TABLE IF EXISTS json_store;
DROP TABLE IF EXISTS sync_metadata;
DROP TABLE IF EXISTS _schema_version;

-- ================================================================
-- CREATE NEW TABLES
-- ================================================================

CREATE TABLE local_tree (
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
);

CREATE TABLE qa_entries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tree_node_id  INTEGER NOT NULL REFERENCES local_tree(id) ON DELETE CASCADE,
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  tags          TEXT,
  score         REAL DEFAULT 0,
  order_index   INTEGER DEFAULT 0,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE image_metadata (
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
);

CREATE TABLE technical_data (
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
);

CREATE TABLE executions (
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
);

CREATE TABLE sync_metadata (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- ================================================================
-- INDEXES
-- ================================================================
CREATE INDEX idx_local_tree_parent ON local_tree(parent_id);
CREATE INDEX idx_local_tree_type   ON local_tree(node_type);
CREATE INDEX idx_local_tree_path   ON local_tree(path);
CREATE INDEX idx_qa_tree_node      ON qa_entries(tree_node_id);
CREATE INDEX idx_qa_score         ON qa_entries(score DESC);
CREATE INDEX idx_img_tree_node    ON image_metadata(tree_node_id);
CREATE INDEX idx_img_category     ON image_metadata(category);
CREATE INDEX idx_tech_tree_node   ON technical_data(tree_node_id);
CREATE INDEX idx_tech_data_type   ON technical_data(data_type);
CREATE INDEX idx_tech_code        ON technical_data(code);
CREATE INDEX idx_exec_started     ON executions(started_at DESC);
CREATE INDEX idx_exec_phase       ON executions(phase);

-- ================================================================
-- INITIAL DATA
-- ================================================================
INSERT INTO sync_metadata (key, value, updated_at) VALUES ('schema_version', '7', strftime('%s', 'now') * 1000);

COMMIT;

PRAGMA foreign_keys = ON;
