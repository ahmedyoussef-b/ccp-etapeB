import { MediaCacheService } from './media-cache.service';
import { MediaFallbackService } from './media-fallback.service';

export interface MediaLoadOptions {
  timeout?: number;
  forceReload?: boolean;
  thumbnailOnly?: boolean;
}

export interface MediaLoadResult {
  dataUrl: string;
  source: 'cache' | 'api' | 'indexeddb' | 'sqlite' | 'placeholder';
  cached: boolean;
  duration: number;
  size?: number;
  mimeType?: string;
}

export class LazyMediaLoader {
  private static cache = MediaCacheService.getInstance();
  private static fallback = MediaFallbackService;
  private static defaultTimeout = 10000;

  static async loadMedia(id: string, options: MediaLoadOptions = {}): Promise<MediaLoadResult> {
    const startTime = Date.now();
    const timeout = options.timeout ?? LazyMediaLoader.defaultTimeout;

    if (!options.forceReload) {
      const cached = await LazyMediaLoader.cache.get(id);
      if (cached) {
        return {
          dataUrl: cached,
          source: 'cache',
          cached: true,
          duration: Date.now() - startTime,
        };
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`/api/media/${encodeURIComponent(id)}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const dataUrl = await response.text();
      const size = dataUrl.length;

      try {
        await LazyMediaLoader.cache.set(id, dataUrl);
      } catch {
        // Cache write failed, still return data
      }

      return {
        dataUrl,
        source: 'api',
        cached: false,
        duration: Date.now() - startTime,
        size,
        mimeType: LazyMediaLoader.detectMimeType(dataUrl),
      };
    } catch (error) {
      return LazyMediaLoader.loadFromFallback(id, startTime, error);
    }
  }

  static async preloadMedia(id: string): Promise<void> {
    await LazyMediaLoader.loadMedia(id);
  }

  static async clearCache(): Promise<void> {
    await LazyMediaLoader.cache.clear();
  }

  static async isCached(id: string): Promise<boolean> {
    return LazyMediaLoader.cache.has(id);
  }

  private static async loadFromFallback(id: string, startTime: number, error: unknown): Promise<MediaLoadResult> {
    let fallbackSource: 'indexeddb' | 'sqlite' | 'placeholder' = 'placeholder';
    let dataUrl: string | null = null;

    if (error instanceof Error && error.name !== 'AbortError') {
      dataUrl = await MediaFallbackService.loadFromIndexedDB(id);
      if (dataUrl) {
        fallbackSource = 'indexeddb';
      } else {
        dataUrl = await MediaFallbackService.loadFromSQLite(id);
        if (dataUrl) {
          fallbackSource = 'sqlite';
        }
      }
    }

    if (!dataUrl) {
      dataUrl = MediaFallbackService.loadPlaceholder();
    }

    return {
      dataUrl,
      source: fallbackSource,
      cached: false,
      duration: Date.now() - startTime,
    };
  }

  private static detectMimeType(dataUrl: string): string | undefined {
    const match = dataUrl.match(/^data:([^;]+);/);
    return match?.[1];
  }
}
