export interface MediaCacheEntry {
  data: string;
  timestamp: number;
}

export class MediaCacheService {
  private static cacheName = 'nexaflow-media';
  private static instance: MediaCacheService | null = null;

  static getInstance(): MediaCacheService {
    if (!MediaCacheService.instance) {
      MediaCacheService.instance = new MediaCacheService();
    }
    return MediaCacheService.instance;
  }

  async get(key: string): Promise<string | null> {
    try {
      const cache = await caches.open(MediaCacheService.cacheName);
      const response = await cache.match(key);
      if (!response) return null;
      const entry = await response.json() as MediaCacheEntry;
      return entry?.data ?? null;
    } catch {
      return null;
    }
  }

  async set(key: string, data: string): Promise<void> {
    try {
      const cache = await caches.open(MediaCacheService.cacheName);
      const entry: MediaCacheEntry = { data, timestamp: Date.now() };
      const response = new Response(JSON.stringify(entry), {
        headers: { 'Content-Type': 'application/json' },
      });
      await cache.put(key, response);
    } catch {
      // Cache write failed, silently ignore
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const cache = await caches.open(MediaCacheService.cacheName);
      const response = await cache.match(key);
      return response !== undefined;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const cache = await caches.open(MediaCacheService.cacheName);
      await cache.delete(key);
    } catch {
      // Ignore
    }
  }

  async clear(): Promise<void> {
    try {
      const cache = await caches.open(MediaCacheService.cacheName);
      const keys = await cache.keys();
      for (const request of keys) {
        await cache.delete(request);
      }
    } catch {
      // Ignore
    }
  }

  async keys(): Promise<string[]> {
    try {
      const cache = await caches.open(MediaCacheService.cacheName);
      const keys = await cache.keys();
      return keys.map(key => key.url);
    } catch {
      return [];
    }
  }
}
