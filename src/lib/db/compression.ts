import { gzipSync, gunzipSync } from 'node:zlib';
import type { Database, BindingSpec } from '@sqlite.org/sqlite-wasm';

const COMPRESSION_THRESHOLD = 1024;
const COMPRESSED_MARKER = 0x01;

export interface CompressionMetrics {
  compressed: number;
  sizeBefore: number;
  sizeAfter: number;
  errors: string[];
}

export function isCompressedData(data: Uint8Array | Buffer): boolean {
  return data.length > 0 && data[0] === COMPRESSED_MARKER;
}

export function compressBuffer(buffer: Buffer | Uint8Array): Buffer {
  if (buffer.length <= COMPRESSION_THRESHOLD) {
    return Buffer.from(buffer);
  }

  const compressed = gzipSync(Buffer.from(buffer));

  const result = Buffer.alloc(1 + compressed.length);
  result[0] = COMPRESSED_MARKER;
  compressed.copy(result, 1);
  return result;
}

export function isBlobCompressed(blob: Uint8Array | Buffer): boolean {
  return isCompressedData(blob);
}

export function decompressBlob(blob: Uint8Array | Buffer): Buffer {
  const buffer = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  if (buffer.length === 0) return buffer;

  if (!isCompressedData(buffer)) {
    return buffer;
  }

  try {
    return gunzipSync(buffer.subarray(1));
  } catch (error) {
    console.error('Failed to decompress blob:', error);
    return buffer.subarray(1);
  }
}

export function compressBlob(data: Uint8Array | Buffer): Buffer {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buffer.length === 0) return buffer;

  const compressed = gzipSync(buffer);
  const result = Buffer.alloc(compressed.length + 1);
  result[0] = COMPRESSED_MARKER;
  compressed.copy(result, 1);
  return result;
}

export function getDecompressedContent(
  db: Database,
  nodeId: number
): { content: Buffer; isCompressed: boolean } | null {
  try {
    const stmt = db.prepare(
      'SELECT content FROM local_tree WHERE id = ? AND node_type = ? LIMIT 1'
    );
    stmt.bind([nodeId, 'file'] as BindingSpec);

    if (!stmt.step()) {
      stmt.finalize();
      return null;
    }

    const row = stmt.get({}) as { content: Uint8Array | null };
    stmt.finalize();

    if (!row || !row.content) {
      return null;
    }

    const blob = Buffer.from(row.content);
    const compressed = isCompressedData(blob);

    return {
      content: compressed ? decompressBlob(blob) : blob,
      isCompressed: compressed,
    };
  } catch (error) {
    console.error(`Failed to get content for node ${nodeId}:`, error);
    return null;
  }
}

export function getDecompressedTechnicalData(
  db: Database,
  id: number
): Buffer | null {
  try {
    const stmt = db.prepare(
      'SELECT body FROM technical_data WHERE id = ? LIMIT 1'
    );
    stmt.bind([id] as BindingSpec);

    if (!stmt.step()) {
      stmt.finalize();
      return null;
    }

    const row = stmt.get({}) as { body: Uint8Array | null };
    stmt.finalize();

    if (!row || !row.body) {
      return null;
    }

    return decompressBlob(Buffer.from(row.body));
  } catch (error) {
    console.error(`Failed to get technical data for id ${id}:`, error);
    return null;
  }
}

export function shouldCompress(size: number): boolean {
  return size > COMPRESSION_THRESHOLD;
}

export function enableCompression(db: Database): boolean {
  try {
    const stmt = db.prepare('SELECT sqlite_version() AS version');
    stmt.step();
    const row = stmt.get({}) as { version: string };
    stmt.finalize();

    const parts = row.version.split('.').map(Number);
    const major = parts[0] ?? 0;
    const minor = parts[1] ?? 0;

    if (major < 3 || (major === 3 && minor < 32)) {
      console.warn(`SQLite ${row.version} detected. Compression requires >= 3.32.0`);
      return false;
    }

    db.exec('PRAGMA compression_algorithm = ZLIB');

    const enabled = isCompressionEnabled(db);
    if (!enabled) {
      console.warn('PRAGMA compression_algorithm did not enable ZLIB');
    }
    return enabled;
  } catch {
    return false;
  }
}

export function isCompressionEnabled(db: Database): boolean {
  try {
    const stmt = db.prepare('PRAGMA compression_algorithm');
    stmt.step();
    const row = stmt.get({}) as { compression_algorithm: string };
    stmt.finalize();
    return row.compression_algorithm === 'ZLIB';
  } catch {
    return false;
  }
}

export async function compressAllData(db: Database): Promise<CompressionMetrics> {
  const metrics: CompressionMetrics = {
    compressed: 0,
    sizeBefore: 0,
    sizeAfter: 0,
    errors: [],
  };

  const sqliteCompressionEnabled = isCompressionEnabled(db);
  if (!sqliteCompressionEnabled) {
    const enabled = enableCompression(db);
    if (!enabled) {
      metrics.errors.push('SQLite ZLIB compression PRAGMA not available, using application-level compression');
    }
  }

  db.exec('BEGIN TRANSACTION');

  try {
    await compressTableContent(db, 'local_tree', 'content', metrics, {
      skipIf: (row) => {
        const mimeType = (row.mime_type as string | null) || '';
        return mimeType.startsWith('image/');
      },
      minSize: 1024,
      extraColumns: ['mime_type'],
    });

    await compressTableContent(db, 'technical_data', 'body', metrics, {
      minSize: 1024,
    });

    const markStmt = db.prepare(
      "INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)"
    );
    markStmt.bind(['compression:enabled', 'true', Date.now()] as BindingSpec);
    markStmt.step();
    markStmt.finalize();

    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    metrics.errors.push(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }

  return metrics;
}

async function compressTableContent(
  db: Database,
  tableName: string,
  columnName: string,
  metrics: CompressionMetrics,
  options: { skipIf?: (row: Record<string, unknown>) => boolean; minSize?: number; extraColumns?: string[] } = {}
): Promise<void> {
  const minSize = options.minSize ?? 0;
  const extraColumns = options.extraColumns ?? [];

  const columns = ['id', columnName, ...extraColumns].filter((col, idx, arr) => arr.indexOf(col) === idx);
  const selectSql = `SELECT ${columns.join(', ')} FROM ${tableName} WHERE ${columnName} IS NOT NULL`;
  const selectStmt = db.prepare(selectSql);
  const updateSql = `UPDATE ${tableName} SET ${columnName} = ? WHERE id = ?`;
  const updateStmt = db.prepare(updateSql);

  while (selectStmt.step()) {
    const row = selectStmt.get({}) as Record<string, unknown>;
    const id = row.id as number;
    const blob = row[columnName] as Uint8Array | null;

    if (!blob) continue;

    if (options.skipIf && options.skipIf(row)) {
      metrics.sizeBefore += blob.length;
      metrics.sizeAfter += blob.length;
      continue;
    }

    if (blob.length < minSize) {
      metrics.sizeBefore += blob.length;
      metrics.sizeAfter += blob.length;
      continue;
    }

    metrics.sizeBefore += blob.length;

    try {
      const compressed = compressBuffer(Buffer.from(blob));

      if (compressed.length < blob.length) {
        updateStmt.bind([new Uint8Array(compressed), id] as BindingSpec);
        updateStmt.step();
        metrics.compressed++;
        metrics.sizeAfter += compressed.length;
      } else {
        metrics.sizeAfter += blob.length;
      }
    } catch (error) {
      metrics.errors.push(`Failed to compress ${tableName} id ${id}: ${error instanceof Error ? error.message : String(error)}`);
      metrics.sizeAfter += blob.length;
    }
  }

  selectStmt.finalize();
  updateStmt.finalize();
}
