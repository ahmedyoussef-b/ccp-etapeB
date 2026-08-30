import { createHash } from 'crypto';
import { getDb } from '@/lib/client-engine/sqlite';
import { prisma } from '@/lib/prisma';

// ==================== TYPES ====================

export interface PgToSqliteSyncReport {
  success: boolean;
  inserted: number;
  updated: number;
  deleted: number;
  errors: string[];
  duration: number;
  checksumValid: boolean;
}

export interface SyncRecord {
  id: number;
  checksum: string;
  data: Record<string, unknown>;
}

// ==================== CONSTANTS ====================

const SYNC_METADATA_KEY = 'last_pg_to_sqlite_sync';
const RETENTION_DAYS: Record<string, number> = {
  executions: 7,
  technical_data: 30,
  image_metadata: 60,
};

const PG_TO_SQLITE_TABLES = [
  'qa_entries',
  'image_metadata',
  'technical_data',
  'executions',
];

// ==================== LOGGER ====================

const logger = {
  sync: (action: string, data?: unknown) =>
    console.log(`[PG-TO-SQLITE-SYNC] ${action}`, data ? JSON.stringify(data, null, 2) : ''),
  syncError: (action: string, error: unknown) =>
    console.error(`[PG-TO-SQLITE-SYNC] [ERROR] ${action}`, error instanceof Error ? error.message : String(error)),
};

// ==================== SERVICE ====================

export class PgToSqliteSyncService {
  private static instance: PgToSqliteSyncService | null = null;

  static getInstance(): PgToSqliteSyncService {
    if (!PgToSqliteSyncService.instance) {
      PgToSqliteSyncService.instance = new PgToSqliteSyncService();
    }
    return PgToSqliteSyncService.instance;
  }

  async sync(options?: { since?: Date }): Promise<PgToSqliteSyncReport> {
    const startTime = Date.now();
    const report: PgToSqliteSyncReport = {
      success: false,
      inserted: 0,
      updated: 0,
      deleted: 0,
      errors: [],
      duration: 0,
      checksumValid: true,
    };

    try {
      const db = getDb();
      if (!db) {
        report.errors.push('SQLite not initialized');
        report.duration = Date.now() - startTime;
        return report;
      }

      const since = options?.since || await this.getLastSyncTimestamp();

      for (const table of PG_TO_SQLITE_TABLES) {
        try {
          const tableReport = await this.syncTable(db, table, since);
          report.inserted += tableReport.inserted;
          report.updated += tableReport.updated;
          report.deleted += tableReport.deleted;
          report.errors.push(...tableReport.errors);
          if (!tableReport.checksumValid) {
            report.checksumValid = false;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'unknown';
          report.errors.push(`${table}: ${msg}`);
        }
      }

      if (report.errors.length === 0) {
        await this.setLastSyncTimestamp(new Date());
        await this.purgeOldRecords();
      }

      report.success = report.errors.length === 0 && report.checksumValid;
      report.duration = Date.now() - startTime;

      logger.sync('sync_completed', report);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'unknown';
      report.errors.push(msg);
      report.duration = Date.now() - startTime;
      logger.syncError('sync_failed', error);
    }

    return report;
  }

  // ==================== TABLE SYNC ====================

  private async syncTable(db: Awaited<ReturnType<typeof getDb>>, table: string, since: Date): Promise<PgToSqliteSyncReport> {
    const report: PgToSqliteSyncReport = {
      success: false,
      inserted: 0,
      updated: 0,
      deleted: 0,
      errors: [],
      duration: 0,
      checksumValid: true,
    };

    try {
      const records = await this.fetchPgRecords(table, since);
      const cursor = this.buildCursor(since);

      (db as any).exec('BEGIN TRANSACTION');

      try {
        for (const record of records) {
          const checksum = this.computeChecksum(table, record);
          const storedChecksum = await this.getStoredChecksum(table, record.id as number);

          if (storedChecksum && storedChecksum === checksum) {
            continue;
          }

          const exists = await this.findLocalRecord(db, table, record.id as number);

          if (exists) {
            await this.updateLocalRecord(db, table, record);
            report.updated++;
          } else {
            await this.insertLocalRecord(db, table, record);
            report.inserted++;
          }

          await this.setChecksum(table, record.id as number, checksum);
        }

        (db as any).exec('COMMIT');
        report.success = true;
      } catch (error) {
        try { (db as any).exec('ROLLBACK'); } catch { /* ignore */ }
        throw error;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'unknown';
      report.errors.push(`${table}: ${msg}`);
    }

    return report;
  }

  // ==================== POSTGRESQL ====================

  private async fetchPgRecords(table: string, since: Date): Promise<Array<Record<string, unknown>>> {
    const records: Array<Record<string, unknown>> = [];

    switch (table) {
      case 'qa_entries': {
        const rows = await prisma.qaEntry.findMany({
          where: { updatedAt: { gt: since } },
          orderBy: { updatedAt: 'asc' },
        });
        records.push(...rows.map(r => ({ ...r, _table: 'qa_entries' })));
        break;
      }
      case 'image_metadata': {
        const rows = await prisma.imageMetadata.findMany({
          where: { updatedAt: { gt: since } },
          orderBy: { updatedAt: 'asc' },
        });
        records.push(...rows.map(r => ({ ...r, _table: 'image_metadata' })));
        break;
      }
      case 'technical_data': {
        const rows = await prisma.technicalData.findMany({
          where: { updatedAt: { gt: since } },
          orderBy: { updatedAt: 'asc' },
        });
        records.push(...rows.map(r => ({ ...r, _table: 'technical_data' })));
        break;
      }
      case 'executions': {
        const rows = await prisma.execution.findMany({
          where: { updatedAt: { gt: since } },
          orderBy: { updatedAt: 'asc' },
        });
        records.push(...rows.map(r => ({ ...r, _table: 'executions' })));
        break;
      }
      default:
        break;
    }

    return records;
  }

  // ==================== SQLITE HELPERS ====================

  private async findLocalRecord(db: Awaited<ReturnType<typeof getDb>>, table: string, id: number): Promise<Record<string, unknown> | null> {
    const rows = await queryLocal(db, `SELECT * FROM "${table}" WHERE id = ? LIMIT 1`, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  private async insertLocalRecord(db: Awaited<ReturnType<typeof getDb>>, table: string, record: Record<string, unknown>): Promise<void> {
    const columns = Object.keys(record).filter(k => k !== '_table' && k !== 'id');
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(c => this.mapValue(table, c, record[c]));

    await runLocal(db, `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`, values);
  }

  private async updateLocalRecord(db: Awaited<ReturnType<typeof getDb>>, table: string, record: Record<string, unknown>): Promise<void> {
    const updates = Object.entries(record)
      .filter(([k]) => k !== '_table' && k !== 'id')
      .map(([k]) => `"${k}" = ?`)
      .join(', ');

    const values = Object.entries(record)
      .filter(([k]) => k !== '_table' && k !== 'id')
      .map(([key, val]) => this.mapValue(table, key, val));

    await runLocal(db, `UPDATE "${table}" SET ${updates} WHERE id = ?`, [...values, record.id as number]);
  }

  private mapValue(table: string, column: string, value: unknown): unknown {
    if (value === undefined) return null;

    if (table === 'technical_data' && column === 'body' && Buffer.isBuffer(value)) {
      return value;
    }

    if (table === 'image_metadata') {
      if (column === 'captured_at' && typeof value === 'number') {
        return value;
      }
    }

    return value;
  }

  // ==================== CHECKSUM ====================

  private computeChecksum(table: string, record: Record<string, unknown>): string {
    const payload = JSON.stringify({
      table,
      id: record.id,
      data: Object.fromEntries(
        Object.entries(record).filter(([k]) => !['_table', 'id', 'createdAt', 'updatedAt'].includes(k))
      ),
    });
    return createHash('sha256').update(payload).digest('hex');
  }

  private async getStoredChecksum(table: string, id: number): Promise<string | null> {
    const db = getDb();
    if (!db) return null;
    const key = `checksum:${table}:${id}`;
    const rows = await queryLocal<{ value: string }>(db, `SELECT value FROM sync_metadata WHERE key = ? LIMIT 1`, [key]);
    return rows.length > 0 ? rows[0].value : null;
  }

  private async setChecksum(table: string, id: number, checksum: string): Promise<void> {
    const db = getDb();
    if (!db) return;
    await runLocal(db, `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, datetime('now'))`, [
      `checksum:${table}:${id}`,
      checksum,
    ]);
  }

  // ==================== PURGE ====================

  private async purgeOldRecords(): Promise<void> {
    const { prisma } = await import('@/lib/prisma');

    for (const [table, days] of Object.entries(RETENTION_DAYS)) {
      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        switch (table) {
          case 'executions': {
            const count = await prisma.execution.deleteMany({
              where: { updatedAt: { lt: cutoff } },
            });
            logger.sync('purge_executions', { count: count.count, olderThan: cutoff.toISOString() });
            break;
          }
          case 'technical_data': {
            const count = await prisma.technicalData.deleteMany({
              where: { updatedAt: { lt: cutoff } },
            });
            logger.sync('purge_technical_data', { count: count.count, olderThan: cutoff.toISOString() });
            break;
          }
          case 'image_metadata': {
            const count = await prisma.imageMetadata.deleteMany({
              where: { updatedAt: { lt: cutoff } },
            });
            logger.sync('purge_image_metadata', { count: count.count, olderThan: cutoff.toISOString() });
            break;
          }
          default:
            break;
        }
      } catch (error) {
        logger.syncError(`purge_${table}`, error);
      }
    }
  }

  // ==================== METADATA ====================

  private async getLastSyncTimestamp(): Promise<Date> {
    return this.getMetadata(SYNC_METADATA_KEY, new Date(0));
  }

  private async setLastSyncTimestamp(date: Date): Promise<void> {
    await this.setMetadata(SYNC_METADATA_KEY, date.toISOString());
  }

  private async getMetadata(key: string, defaultValue: Date): Promise<Date> {
    try {
      const db = getDb();
      if (!db) return defaultValue;
      const rows = await queryLocal<{ value: string }>(db, `SELECT value FROM sync_metadata WHERE key = ? LIMIT 1`, [key]);
      if (rows.length === 0) return defaultValue;
      const date = new Date(rows[0].value);
      return isNaN(date.getTime()) ? defaultValue : date;
    } catch {
      return defaultValue;
    }
  }

  private async setMetadata(key: string, value: string): Promise<void> {
    const db = getDb();
    if (!db) return;
    await runLocal(db, `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, datetime('now'))`, [key, value]);
  }

  private buildCursor(since: Date): string {
    return since.toISOString();
  }
}

// ==================== HELPERS ====================

async function queryLocal<T = Record<string, unknown>>(db: Awaited<ReturnType<typeof getDb>>, sql: string, params: unknown[] = []): Promise<T[]> {
  const stmt = (db as any).prepare(sql);
  try {
    if (params.length > 0) stmt.bind(params as any);
    const results: T[] = [];
    while (stmt.step()) results.push(stmt.get({}) as T);
    return results;
  } finally {
    stmt.finalize();
  }
}

async function runLocal(db: Awaited<ReturnType<typeof getDb>>, sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
  const stmt = (db as any).prepare(sql);
  try {
    if (params.length > 0) stmt.bind(params as any);
    stmt.step();
    const idStmt = (db as any).prepare('SELECT last_insert_rowid() as rid');
    idStmt.step();
    const lastInsertRowid = Number((idStmt.get({}) as { rid: number }).rid ?? 0);
    idStmt.finalize();
    return { changes: (db as any).changes(), lastInsertRowid };
  } finally {
    stmt.finalize();
  }
}

// ==================== SINGLETON EXPORT ====================

export const pgToSqliteSync = PgToSqliteSyncService.getInstance();
