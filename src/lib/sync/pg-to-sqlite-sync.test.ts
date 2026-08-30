import { describe, it, expect, vi } from 'vitest';
import { PgToSqliteSyncService } from '@/lib/sync/pg-to-sqlite-sync.service';

describe('PgToSqliteSyncService', () => {
  it('should have a singleton instance', () => {
    const service = PgToSqliteSyncService.getInstance();
    expect(service).toBeDefined();
    expect(typeof service.sync).toBe('function');
  });

  it('should return a valid report structure', async () => {
    const service = PgToSqliteSyncService.getInstance();

    vi.mock('@/lib/client-engine/sqlite', () => ({
      getDb: () => null,
    }));

    const report = await service.sync({ since: new Date(0) });

    expect(report).toHaveProperty('success');
    expect(report).toHaveProperty('inserted');
    expect(report).toHaveProperty('updated');
    expect(report).toHaveProperty('deleted');
    expect(report).toHaveProperty('errors');
    expect(report).toHaveProperty('duration');
    expect(report).toHaveProperty('checksumValid');
    expect(typeof report.success).toBe('boolean');
    expect(typeof report.duration).toBe('number');
    expect(Array.isArray(report.errors)).toBe(true);
  });
});
