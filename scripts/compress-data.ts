#!/usr/bin/env tsx

import { createHash, randomBytes } from 'crypto';
import { existsSync, mkdirSync, copyFileSync, statSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { enableCompression, compressAllData } from '../src/lib/db/compression';

const DB_PATH = resolve(process.cwd(), '.local-db', 'nexaflow-client.sqlite');
const BACKUP_PATH = `${DB_PATH}.bak.${Date.now()}`;
const LOG_PATH = resolve(process.cwd(), 'logs', 'compression.log');

interface CompressionReport {
  timestamp: string;
  dbPath: string;
  sizeBefore: number;
  sizeAfter: number;
  compressedCount: number;
  ratio: number;
  duration: number;
  errors: string[];
  dryRun: boolean;
  checksumBefore: string;
  checksumAfter: string;
}

async function computeChecksum(filePath: string): Promise<string> {
  const { readFileSync } = await import('fs');
  const data = readFileSync(filePath);
  return createHash('sha256').update(data).digest('hex');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function logReport(report: CompressionReport): Promise<void> {
  const logDir = dirname(LOG_PATH);
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  const logEntry = [
    `[${report.timestamp}]`,
    `DB: ${report.dbPath}`,
    `Size: ${formatBytes(report.sizeBefore)} → ${formatBytes(report.sizeAfter)} (${(report.ratio * 100).toFixed(1)}%)`,
    `Compressed: ${report.compressedCount} blobs`,
    `Duration: ${report.duration.toFixed(2)}s`,
    `Checksum: ${report.checksumBefore} → ${report.checksumAfter}`,
    `Errors: ${report.errors.length}`,
    `Dry run: ${report.dryRun ? 'YES' : 'NO'}`,
    '-'.repeat(60),
  ].join('\n');

  writeFileSync(LOG_PATH, logEntry + '\n', { flag: 'a' });
  console.log(`📝 Log written to ${LOG_PATH}`);
}

async function initSqlite(dbPath: string): Promise<any> {
  const mod = await import('@sqlite.org/sqlite-wasm');
  const sqlite3Static: any = await (mod.default as any)({
    print: (msg: string) => console.log('[SQLite]', msg),
    printErr: (msg: string) => console.error('[SQLite:ERR]', msg),
  });

  return new (sqlite3Static as any).oo1.DB(dbPath);
}

async function ensureSchema(db: any): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS local_tree (
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
    );
    CREATE TABLE IF NOT EXISTS qa_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tree_node_id INTEGER NOT NULL REFERENCES local_tree(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      tags TEXT,
      score REAL DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS image_metadata (
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
    );
    CREATE TABLE IF NOT EXISTS technical_data (
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
    );
    CREATE TABLE IF NOT EXISTS executions (
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
    );
    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `;
  db.exec(sql);
}

async function main(): Promise<void> {
  console.log('🔍 Starting compression...');

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  if (dryRun) {
    console.log('⚠️  DRY RUN mode - no changes will be made');
  }

  if (!existsSync(DB_PATH)) {
    console.error(`❌ Database not found at ${DB_PATH}`);
    process.exit(1);
  }

  try {
    const stat = statSync(DB_PATH);
    const sizeBefore = stat.size;

    console.log('📊 Computing checksum...');
    const checksumBefore = await computeChecksum(DB_PATH);
    console.log(`📊 Size before: ${formatBytes(sizeBefore)}`);
    console.log(`📊 Checksum: ${checksumBefore.slice(0, 16)}...`);

    if (!dryRun) {
      console.log('💾 Creating backup...');
      mkdirSync(dirname(BACKUP_PATH), { recursive: true });
      copyFileSync(DB_PATH, BACKUP_PATH);
      console.log(`💾 Backup created at ${BACKUP_PATH}`);
    }

    console.log('📂 Opening database...');
    const db = await initSqlite(DB_PATH);
    await ensureSchema(db);

    console.log('⚙️ Enabling compression...');
    const compressionEnabled = enableCompression(db);
    if (!compressionEnabled) {
      console.warn('⚠️  SQLite compression not available, using application-level compression');
    }

    console.log('📦 Compressing data...');
    const startTime = Date.now();

    const metrics = await compressAllData(db);

    const duration = (Date.now() - startTime) / 1000;

    const sizeAfter = statSync(DB_PATH).size;
    const ratio = sizeAfter / sizeBefore;
    const compressionGain = ((1 - ratio) * 100);

    console.log(`\n✅ Compression complete!`);
    console.log(`   📊 ${formatBytes(sizeBefore)} → ${formatBytes(sizeAfter)} (${compressionGain.toFixed(1)}% gain)`);
    console.log(`   📦 ${metrics.compressed} blobs compressed`);
    console.log(`   ⏱️  ${duration.toFixed(2)}s`);
    console.log(`   ❌ ${metrics.errors.length} errors`);

    if (metrics.errors.length > 0 && verbose) {
      metrics.errors.forEach(err => console.warn(`   ⚠️  ${err}`));
    }

    const checksumAfter = await computeChecksum(DB_PATH);
    console.log(`📊 Checksum after: ${checksumAfter.slice(0, 16)}...`);

    const report: CompressionReport = {
      timestamp: new Date().toISOString(),
      dbPath: DB_PATH,
      sizeBefore,
      sizeAfter,
      compressedCount: metrics.compressed,
      ratio,
      duration,
      errors: metrics.errors,
      dryRun,
      checksumBefore,
      checksumAfter,
    };

    await logReport(report);

    if (!dryRun && metrics.errors.length === 0) {
      console.log('🧹 Cleaning up backup...');
      console.log(`💾 Backup kept at ${BACKUP_PATH} (will auto-expire)`);
    }

    if (metrics.errors.length > 0) {
      console.warn('⚠️  Some errors occurred - check the log');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error(`❌ Failed: ${error}`);
    console.log(`💾 Backup available at ${BACKUP_PATH}`);
    process.exit(1);
  }
}

main().catch(console.error);
