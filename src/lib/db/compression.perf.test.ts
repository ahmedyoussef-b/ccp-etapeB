/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';

let dbCounter = 0;
let sqlite3Static: any;
let db: any;

async function createPerfSchema(database: any): Promise<void> {
  database.exec(`
    CREATE TABLE local_tree (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      node_type TEXT NOT NULL,
      parent_id INTEGER,
      sort_order INTEGER DEFAULT 0,
      path TEXT NOT NULL UNIQUE,
      size INTEGER DEFAULT 0,
      mime_type TEXT,
      content BLOB,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  database.exec(`
    CREATE TABLE technical_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tree_node_id INTEGER NOT NULL,
      data_type TEXT NOT NULL,
      code TEXT,
      title TEXT,
      body BLOB,
      version INTEGER DEFAULT 1,
      status TEXT,
      tags TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  database.exec(`
    CREATE TABLE sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

beforeAll(async () => {
  const mod = await import('@sqlite.org/sqlite-wasm');
  const init = mod.default as unknown as (opts?: { print?: () => void; printErr?: () => void }) => Promise<any>;
  sqlite3Static = await init({
    print: () => {},
    printErr: () => {},
  });
}, 30000);

beforeEach(async () => {
  db = new sqlite3Static.oo1.DB(`test-compression-perf-${++dbCounter}`);
  await createPerfSchema(db);
});

afterEach(() => {
  db.close();
});

describe('Compression - Performance', () => {
  it('should compress 10 MB of JSON data in < 2 seconds', async () => {
    const { compressAllData } = await import('@/lib/db/compression');

    const size = 10 * 1024 * 1024;
    const chunkSize = 100 * 1024;
    const numChunks = Math.ceil(size / chunkSize);

    const insertStmt = db.prepare(
      'INSERT INTO local_tree (name, node_type, path, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );

    for (let i = 0; i < numChunks; i++) {
      const data = JSON.stringify({
        id: i,
        data: 'x'.repeat(Math.min(chunkSize, size - i * chunkSize)),
        timestamp: Date.now(),
        metadata: { source: 'perf-test', version: 1 },
      });
      insertStmt.bind([`chunk-${i}.json`, 'file', `/chunk-${i}.json`, new Uint8Array(Buffer.from(data)), 1000, 1000]);
      insertStmt.step();
      insertStmt.reset();
    }
    insertStmt.finalize();

    const startTime = Date.now();
    const metrics = await compressAllData(db);
    const duration = (Date.now() - startTime) / 1000;

    expect(metrics.compressed).toBeGreaterThan(0);
    expect(metrics.sizeAfter).toBeLessThan(metrics.sizeBefore);
    expect(duration).toBeLessThan(2);

    const ratio = metrics.sizeBefore / metrics.sizeAfter;
    expect(ratio).toBeGreaterThan(1);
  });

  it('should decompress 10 MB in < 500ms', async () => {
    const { compressAllData, decompressBlob } = await import('@/lib/db/compression');

    const largeData = JSON.stringify({ data: 'x'.repeat(10 * 1024 * 1024), metadata: { test: true } });
    const insertStmt = db.prepare(
      'INSERT INTO local_tree (name, node_type, path, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insertStmt.bind(['large.json', 'file', '/large.json', new Uint8Array(Buffer.from(largeData)), 1000, 1000]);
    insertStmt.step();
    insertStmt.finalize();

    await compressAllData(db);

    const selectStmt = db.prepare('SELECT content FROM local_tree WHERE id = ?');
    selectStmt.bind([1]);
    selectStmt.step();
    const row = selectStmt.get({}) as { content: Uint8Array };
    selectStmt.finalize();

    const startTime = Date.now();
    const decompressed = decompressBlob(row.content);
    const duration = (Date.now() - startTime) / 1000;

    expect(decompressed.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(0.5);
  });

  it('should maintain data integrity after compression', async () => {
    const { compressAllData, decompressBlob } = await import('@/lib/db/compression');

    const original = JSON.stringify({ hello: 'world', num: 42 });
    const insertStmt = db.prepare(
      'INSERT INTO local_tree (name, node_type, path, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insertStmt.bind(['doc.json', 'file', '/doc.json', new Uint8Array(Buffer.from(original)), 1000, 1000]);
    insertStmt.step();
    insertStmt.finalize();

    await compressAllData(db);

    const selectStmt = db.prepare('SELECT content FROM local_tree WHERE id = ?');
    selectStmt.bind([1]);
    selectStmt.step();
    const row = selectStmt.get({}) as { content: Uint8Array };
    selectStmt.finalize();

    const decompressed = decompressBlob(row.content);
    expect(decompressed.toString()).toBe(original);
  });

  it('should not crash on large payload', async () => {
    const { compressAllData, getDecompressedContent } = await import('@/lib/db/compression');

    const largeData = JSON.stringify({ data: 'x'.repeat(5 * 1024 * 1024), metadata: { test: true } });
    const insertStmt = db.prepare(
      'INSERT INTO local_tree (name, node_type, path, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insertStmt.bind(['large.json', 'file', '/large.json', new Uint8Array(Buffer.from(largeData)), 1000, 1000]);
    insertStmt.step();
    insertStmt.finalize();

    await expect(compressAllData(db)).resolves.toBeDefined();

    const result = getDecompressedContent(db, 1);
    expect(result).not.toBeNull();
    expect(result?.content.length).toBeGreaterThan(0);
  });
});
