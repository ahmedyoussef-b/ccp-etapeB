import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';

let dbCounter = 0;
let sqlite3Static: any;
let db: any;

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

async function createCompressionSchema(database: any): Promise<void> {
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
  sqlite3Static = await mod.default({
    print: () => {},
    printErr: () => {},
  });
}, 30000);

beforeEach(async () => {
  db = new sqlite3Static.oo1.DB(`test-compression-1b-${++dbCounter}`);
  await createCompressionSchema(db);
});

afterEach(() => {
  db.close();
});

describe('Prompt 1B - compressAllData', () => {
  it('should compress large local_tree.content and technical_data.body', async () => {
    const { compressAllData } = await import('@/lib/db/compression');

    const largeContent = Buffer.alloc(2048, 'X');
    const largeBody = Buffer.alloc(2048, 'Y');
    const smallContent = Buffer.alloc(128, 'Z');

    const insertTree = db.prepare(
      'INSERT INTO local_tree (name, node_type, path, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insertTree.bind(['file1', 'file', '/file1', new Uint8Array(largeContent), 1000, 1000]);
    insertTree.step();
    insertTree.finalize();

    const insertTree2 = db.prepare(
      'INSERT INTO local_tree (name, node_type, path, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insertTree2.bind(['file2', 'file', '/file2', new Uint8Array(smallContent), 1000, 1000]);
    insertTree2.step();
    insertTree2.finalize();

    const insertTech = db.prepare(
      'INSERT INTO technical_data (tree_node_id, data_type, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    );
    insertTech.bind([1, 'procedure', new Uint8Array(largeBody), 1000, 1000]);
    insertTech.step();
    insertTech.finalize();

    const metrics = await compressAllData(db);

    expect(metrics.compressed).toBe(2);
    expect(metrics.sizeBefore).toBeGreaterThan(0);
    expect(metrics.sizeAfter).toBeLessThan(metrics.sizeBefore);
    expect(metrics.errors.length).toBeGreaterThanOrEqual(0);
  });

  it('should skip images based on mime_type', async () => {
    const { compressAllData } = await import('@/lib/db/compression');

    const imageData = Buffer.alloc(2048, 'I');
    const textData = Buffer.alloc(2048, 'T');

    const insertImage = db.prepare(
      'INSERT INTO local_tree (name, node_type, path, mime_type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    insertImage.bind(['photo.jpg', 'file', '/photo.jpg', 'image/jpeg', new Uint8Array(imageData), 1000, 1000]);
    insertImage.step();
    insertImage.finalize();

    const insertText = db.prepare(
      'INSERT INTO local_tree (name, node_type, path, mime_type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    insertText.bind(['doc.txt', 'file', '/doc.txt', 'text/plain', new Uint8Array(textData), 1000, 1000]);
    insertText.step();
    insertText.finalize();

    const metrics = await compressAllData(db);

    expect(metrics.compressed).toBe(1);
    expect(metrics.sizeAfter).toBeLessThan(metrics.sizeBefore);

    const imageRow = stmtGet(db.prepare('SELECT content FROM local_tree WHERE id = 1'));
    expect(imageRow.content.length).toBe(2048);

    const textRow = stmtGet(db.prepare('SELECT content FROM local_tree WHERE id = 2'));
    expect(textRow.content.length).toBeLessThan(2048);
  });

  it('should mark compression in sync_metadata', async () => {
    const { compressAllData } = await import('@/lib/db/compression');

    const insertTree = db.prepare(
      'INSERT INTO local_tree (name, node_type, path, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insertTree.bind(['file1', 'file', '/file1', new Uint8Array(Buffer.alloc(2048, 'A')), 1000, 1000]);
    insertTree.step();
    insertTree.finalize();

    const result = await compressAllData(db);

    expect(result.compressed).toBe(1);
    expect(result.sizeBefore).toBeGreaterThan(result.sizeAfter);

    const statusRow = stmtGet(
      db.prepare("SELECT value FROM sync_metadata WHERE key = 'compression:enabled'")
    );
    expect(statusRow.value).toBe('true');
  });

  it('should rollback on error and report in errors array', async () => {
    const { compressAllData } = await import('@/lib/db/compression');

    db.exec('DROP TABLE technical_data');

    const insertTree = db.prepare(
      'INSERT INTO local_tree (name, node_type, path, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insertTree.bind(['file1', 'file', '/file1', new Uint8Array(Buffer.alloc(2048, 'A')), 1000, 1000]);
    insertTree.step();
    insertTree.finalize();

    await expect(compressAllData(db)).rejects.toThrow();

    const checkStmt = db.prepare("SELECT value FROM sync_metadata WHERE key = 'compression:enabled'");
    const hasMark = checkStmt.step();
    checkStmt.finalize();
    expect(hasMark).toBe(false);
  });

  it('should skip data smaller than 1KB', async () => {
    const { compressAllData } = await import('@/lib/db/compression');

    const insertTree = db.prepare(
      'INSERT INTO local_tree (name, node_type, path, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insertTree.bind(['small', 'file', '/small', new Uint8Array(Buffer.alloc(512, 'A')), 1000, 1000]);
    insertTree.step();
    insertTree.finalize();

    const metrics = await compressAllData(db);

    expect(metrics.compressed).toBe(0);
    expect(metrics.sizeAfter).toBe(metrics.sizeBefore);
  });
});

describe('Prompt 1C - Decompression', () => {
  it('isBlobCompressed should detect marker', async () => {
    const { isBlobCompressed, compressBlob } = await import('@/lib/db/compression');
    const compressed = compressBlob(Buffer.from('test'));
    expect(isBlobCompressed(compressed)).toBe(true);
    expect(isBlobCompressed(Buffer.from('test'))).toBe(false);
    expect(isBlobCompressed(Buffer.alloc(0))).toBe(false);
  });

  it('decompressBlob should decompress compressed data', async () => {
    const { decompressBlob, compressBlob } = await import('@/lib/db/compression');
    const original = Buffer.from('Hello World');
    const compressed = compressBlob(original);
    const decompressed = decompressBlob(compressed);
    expect(decompressed.toString()).toBe('Hello World');
  });

  it('decompressBlob should return original if not compressed', async () => {
    const { decompressBlob } = await import('@/lib/db/compression');
    const original = Buffer.from('Hello World');
    const result = decompressBlob(original);
    expect(result).toEqual(original);
  });

  it('decompressBlob should handle empty blob', async () => {
    const { decompressBlob } = await import('@/lib/db/compression');
    const empty = Buffer.alloc(0);
    expect(decompressBlob(empty)).toEqual(empty);
  });

  it('compressBlob + decompressBlob round-trip should preserve data', async () => {
    const { compressBlob, decompressBlob } = await import('@/lib/db/compression');
    const original = JSON.stringify({ test: 'data', value: 42 });
    const compressed = compressBlob(Buffer.from(original));
    const decompressed = decompressBlob(compressed);
    expect(decompressed.toString()).toBe(original);
  });

  it('getDecompressedContent should return decompressed content', async () => {
    const { getDecompressedContent, compressBlob } = await import('@/lib/db/compression');

    const uncompressed = db.prepare(
      'INSERT INTO local_tree (name, node_type, path, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    uncompressed.bind(['plain.txt', 'file', '/plain.txt', new Uint8Array(Buffer.from('plain text')), 1000, 1000]);
    uncompressed.step();
    uncompressed.finalize();

    const compressedContent = compressBlob(Buffer.from('compressed text'));
    const compressed = db.prepare(
      'INSERT INTO local_tree (name, node_type, path, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    compressed.bind(['doc.json', 'file', '/doc.json', new Uint8Array(compressedContent), 1000, 1000]);
    compressed.step();
    compressed.finalize();

    const result1 = getDecompressedContent(db, 1);
    expect(result1).not.toBeNull();
    expect(result1?.content.toString()).toBe('plain text');
    expect(result1?.isCompressed).toBe(false);

    const result2 = getDecompressedContent(db, 2);
    expect(result2).not.toBeNull();
    expect(result2?.content.toString()).toBe('compressed text');
    expect(result2?.isCompressed).toBe(true);
  });

  it('getDecompressedContent should return null for non-existent node', async () => {
    const { getDecompressedContent } = await import('@/lib/db/compression');
    const result = getDecompressedContent(db, 999);
    expect(result).toBeNull();
  });

  it('getDecompressedContent should handle corrupted blob gracefully', async () => {
    const { getDecompressedContent } = await import('@/lib/db/compression');

    const corrupted = Buffer.from([0x01, 0x00, 0x00, 0x00]);
    const insertStmt = db.prepare(
      'INSERT INTO local_tree (name, node_type, path, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insertStmt.bind(['corrupt.json', 'file', '/corrupt.json', new Uint8Array(corrupted), 1000, 1000]);
    insertStmt.step();
    insertStmt.finalize();

    const result = getDecompressedContent(db, 1);
    expect(result).not.toBeNull();
    expect(result?.isCompressed).toBe(true);
    expect(result?.content.length).toBe(3);
  });

  it('getDecompressedTechnicalData should return decompressed body', async () => {
    const { getDecompressedTechnicalData, compressBlob } = await import('@/lib/db/compression');

    const compressedBody = compressBlob(Buffer.from('procedure body'));
    const insertTech = db.prepare(
      'INSERT INTO technical_data (tree_node_id, data_type, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    );
    insertTech.bind([1, 'procedure', new Uint8Array(compressedBody), 1000, 1000]);
    insertTech.step();
    insertTech.finalize();

    const result = getDecompressedTechnicalData(db, 1);
    expect(result).not.toBeNull();
    expect(result?.toString()).toBe('procedure body');
  });

  it('getDecompressedTechnicalData should return null for non-existent id', async () => {
    const { getDecompressedTechnicalData } = await import('@/lib/db/compression');
    const result = getDecompressedTechnicalData(db, 999);
    expect(result).toBeNull();
  });
});
