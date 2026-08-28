import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Cache API helper
const createMockCache = () => {
  const store = new Map<string, { data: string; timestamp: number }>();
  return {
    store,
    get: vi.fn(async (key: string) => {
      const item = store.get(key);
      if (!item) return undefined;
      return item.data;
    }),
    set: vi.fn(async (key: string, data: string) => {
      store.set(key, { data, timestamp: Date.now() });
    }),
    has: vi.fn(async (key: string) => store.has(key)),
    clear: vi.fn(async () => store.clear()),
    delete: vi.fn(async (key: string) => store.delete(key)),
  };
};

// Types for the lazy media loader service
export interface MediaCache {
  get: (key: string) => Promise<string | null>;
  set: (key: string, data: string) => Promise<void>;
  has: (key: string) => Promise<boolean>;
  clear: () => Promise<void>;
}

export interface MediaFallbackService {
  loadFromIndexedDB: (id: string) => Promise<string | null>;
  loadFromSQLite: (id: string) => Promise<string | null>;
  getPlaceholder: (mimeType?: string) => string;
}

export interface LazyMediaLoaderOptions {
  timeout?: number;
  cache?: MediaCache;
  fallback?: MediaFallbackService;
}

export interface LazyMediaLoaderResult {
  dataUrl: string | null;
  source: 'cache' | 'api' | 'indexeddb' | 'sqlite' | 'placeholder';
  cached: boolean;
  duration: number;
}

export class LazyMediaLoader {
  private cache: MediaCache;
  private fallback: MediaFallbackService;
  private timeout: number;

  constructor(options: LazyMediaLoaderOptions = {}) {
    this.cache = options.cache || createNoOpCache();
    this.fallback = options.fallback || createNoOpFallback();
    this.timeout = options.timeout || 10000;
  }

  async loadMedia(id: string, mimeType?: string): Promise<LazyMediaLoaderResult> {
    const startTime = Date.now();

    try {
      const cached = await this.cache.get(id);
      if (cached) {
        return {
          dataUrl: cached,
          source: 'cache',
          cached: true,
          duration: Date.now() - startTime,
        };
      }
    } catch {
      // Cache read failed, continue to fallback
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`/api/media/${encodeURIComponent(id)}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const dataUrl = await response.text();

      try {
        await this.cache.set(id, dataUrl);
      } catch {
        // Cache write failed, still return the data
      }

      return {
        dataUrl,
        source: 'api',
        cached: false,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return this.loadFromFallback(id, mimeType, startTime, 'timeout');
      }

      if (error instanceof Error && error.message.includes('fetch')) {
        return this.loadFromFallback(id, mimeType, startTime, 'network');
      }

      return this.loadFromFallback(id, mimeType, startTime, 'not_found');
    }
  }

  private async loadFromFallback(id: string, mimeType: string | undefined, startTime: number, reason: string): Promise<LazyMediaLoaderResult> {
    try {
      const indexedDbData = await this.fallback.loadFromIndexedDB(id);
      if (indexedDbData) {
        return {
          dataUrl: indexedDbData,
          source: 'indexeddb',
          cached: false,
          duration: Date.now() - startTime,
        };
      }
    } catch {
      // IndexedDB failed, try SQLite
    }

    try {
      const sqliteData = await this.fallback.loadFromSQLite(id);
      if (sqliteData) {
        return {
          dataUrl: sqliteData,
          source: 'sqlite',
          cached: false,
          duration: Date.now() - startTime,
        };
      }
    } catch {
      // SQLite failed, use placeholder
    }

    return {
      dataUrl: this.fallback.getPlaceholder(mimeType),
      source: 'placeholder',
      cached: false,
      duration: Date.now() - startTime,
    };
  }

  async preload(id: string): Promise<void> {
    await this.loadMedia(id);
  }

  async clearCache(): Promise<void> {
    await this.cache.clear();
  }
}

function createNoOpCache(): MediaCache {
  return {
    get: async () => null,
    set: async () => {},
    has: async () => false,
    clear: async () => {},
  };
}

function createNoOpFallback(): MediaFallbackService {
  return {
    loadFromIndexedDB: async () => null,
    loadFromSQLite: async () => null,
    getPlaceholder: () => 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ddd" width="100" height="100"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">?</text></svg>',
  };
}

describe('LazyMediaLoader', () => {
  let loader: LazyMediaLoader;
  let mockCache: ReturnType<typeof createMockCache>;
  let mockFallback: MediaFallbackService;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCache = createMockCache();
    mockFallback = {
      loadFromIndexedDB: vi.fn(async () => null),
      loadFromSQLite: vi.fn(async () => null),
      getPlaceholder: vi.fn(() => 'data:image/svg+xml,<svg>placeholder</svg>'),
    };
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loadMedia', () => {
    it('should return cached data when available', async () => {
      await mockCache.set('media-1', 'data:image/jpeg;base64,cached');
      loader = new LazyMediaLoader({ cache: mockCache, fallback: mockFallback });

      const result = await loader.loadMedia('media-1');

      expect(result.source).toBe('cache');
      expect(result.dataUrl).toBe('data:image/jpeg;base64,cached');
      expect(result.cached).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch from API when not cached', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => 'data:image/jpeg;base64,from-api',
      } as Response);
      loader = new LazyMediaLoader({ cache: mockCache, fallback: mockFallback });

      const result = await loader.loadMedia('media-1');

      expect(result.source).toBe('api');
      expect(result.dataUrl).toBe('data:image/jpeg;base64,from-api');
      expect(result.cached).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith('/api/media/media-1', expect.any(Object));
    });

    it('should store fetched data in cache', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => 'data:image/jpeg;base64,from-api',
      } as Response);
      loader = new LazyMediaLoader({ cache: mockCache, fallback: mockFallback });

      await loader.loadMedia('media-1');

      const cached = await mockCache.get('media-1');
      expect(cached).toBe('data:image/jpeg;base64,from-api');
    });

    it('should use IndexedDB fallback on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFallback.loadFromIndexedDB = vi.fn(async () => 'data:image/jpeg;base64,from-idb');
      loader = new LazyMediaLoader({ cache: mockCache, fallback: mockFallback });

      const result = await loader.loadMedia('media-1');

      expect(result.source).toBe('indexeddb');
      expect(result.dataUrl).toBe('data:image/jpeg;base64,from-idb');
    });

    it('should use SQLite fallback when IndexedDB returns null', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFallback.loadFromIndexedDB = vi.fn(async () => null);
      mockFallback.loadFromSQLite = vi.fn(async () => 'data:image/jpeg;base64,from-sqlite');
      loader = new LazyMediaLoader({ cache: mockCache, fallback: mockFallback });

      const result = await loader.loadMedia('media-1');

      expect(result.source).toBe('sqlite');
      expect(result.dataUrl).toBe('data:image/jpeg;base64,from-sqlite');
    });

    it('should use placeholder when all fallbacks fail', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFallback.loadFromIndexedDB = vi.fn(async () => null);
      mockFallback.loadFromSQLite = vi.fn(async () => null);
      loader = new LazyMediaLoader({ cache: mockCache, fallback: mockFallback });

      const result = await loader.loadMedia('media-1');

      expect(result.source).toBe('placeholder');
      expect(result.dataUrl).toContain('svg');
    });

    it('should handle HTTP 404 with fallback', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);
      mockFallback.loadFromIndexedDB = vi.fn(async () => 'data:image/jpeg;base64,from-idb');
      loader = new LazyMediaLoader({ cache: mockCache, fallback: mockFallback });

      const result = await loader.loadMedia('media-1');

      expect(result.source).toBe('indexeddb');
      expect(result.dataUrl).toBe('data:image/jpeg;base64,from-idb');
    });

    it('should handle timeout with fallback', async () => {
      mockFetch.mockImplementationOnce(() => new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 200);
      }));
      mockFallback.loadFromIndexedDB = vi.fn(async () => 'data:image/jpeg;base64,from-idb');
      loader = new LazyMediaLoader({ cache: mockCache, fallback: mockFallback, timeout: 100 });

      const result = await loader.loadMedia('media-1');

      expect(result.source).toBe('indexeddb');
      expect(result.dataUrl).toBe('data:image/jpeg;base64,from-idb');
    });

    it('should return duration in result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => 'data:image/jpeg;base64,from-api',
      } as Response);
      loader = new LazyMediaLoader({ cache: mockCache, fallback: mockFallback });

      const result = await loader.loadMedia('media-1');

      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('preload', () => {
    it('should preload media into cache', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => 'data:image/jpeg;base64,preloaded',
      } as Response);
      loader = new LazyMediaLoader({ cache: mockCache, fallback: mockFallback });

      await loader.preload('media-1');

      const cached = await mockCache.get('media-1');
      expect(cached).toBe('data:image/jpeg;base64,preloaded');
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      await mockCache.set('media-1', 'data1');
      await mockCache.set('media-2', 'data2');
      loader = new LazyMediaLoader({ cache: mockCache, fallback: mockFallback });

      await loader.clearCache();

      expect(await mockCache.has('media-1')).toBe(false);
      expect(await mockCache.has('media-2')).toBe(false);
    });
  });
});
