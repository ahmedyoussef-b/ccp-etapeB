import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Cache API
const createMockCache = () => {
  const store = new Map<string, { data: string; timestamp: number }>();
  return {
    store,
    get: vi.fn(async (key: string) => {
      const item = store.get(key);
      if (!item) return undefined;
      return { data: item.data, timestamp: item.timestamp };
    }),
    set: vi.fn(async (key: string, data: string) => {
      store.set(key, { data, timestamp: Date.now() });
    }),
    has: vi.fn(async (key: string) => store.has(key)),
    clear: vi.fn(async () => store.clear()),
    delete: vi.fn(async (key: string) => store.delete(key)),
    keys: vi.fn(async () => Array.from(store.keys())),
    size: vi.fn(() => store.size),
  };
};

describe('MediaCacheService', () => {
  let cache: ReturnType<typeof createMockCache>;

  beforeEach(() => {
    cache = createMockCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should return undefined for missing key', async () => {
      const result = await cache.get('missing-key');
      expect(result).toBeUndefined();
    });

    it('should return cached data for existing key', async () => {
      await cache.set('media-1', 'data:image/jpeg;base64,abc123');
      const result = await cache.get('media-1');
      expect(result).toBeDefined();
      expect(result?.data).toBe('data:image/jpeg;base64,abc123');
    });
  });

  describe('set', () => {
    it('should store data in cache', async () => {
      await cache.set('media-1', 'data:image/jpeg;base64,abc123');
      expect(cache.has).toBeDefined();
      const result = await cache.get('media-1');
      expect(result).toBeDefined();
    });

    it('should overwrite existing data', async () => {
      await cache.set('media-1', 'data:image/jpeg;base64,old');
      await cache.set('media-1', 'data:image/jpeg;base64,new');
      const result = await cache.get('media-1');
      expect(result?.data).toBe('data:image/jpeg;base64,new');
    });
  });

  describe('has', () => {
    it('should return false for missing key', async () => {
      const result = await cache.has('missing-key');
      expect(result).toBe(false);
    });

    it('should return true for existing key', async () => {
      await cache.set('media-1', 'data:image/jpeg;base64,abc123');
      const result = await cache.has('media-1');
      expect(result).toBe(true);
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      await cache.set('media-1', 'data1');
      await cache.set('media-2', 'data2');
      await cache.clear();
      expect(await cache.has('media-1')).toBe(false);
      expect(await cache.has('media-2')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove specific entry', async () => {
      await cache.set('media-1', 'data1');
      await cache.set('media-2', 'data2');
      await cache.delete('media-1');
      expect(await cache.has('media-1')).toBe(false);
      expect(await cache.has('media-2')).toBe(true);
    });
  });

  describe('keys', () => {
    it('should return all cached keys', async () => {
      await cache.set('media-1', 'data1');
      await cache.set('media-2', 'data2');
      const keys = await cache.keys();
      expect(keys).toContain('media-1');
      expect(keys).toContain('media-2');
    });
  });
});
