import type { MediaItem } from "@/lib/images/server-store";

type CachedItems = { data: MediaItem[]; timestamp: number };

const TTL_MS = 60_000;
let cache: CachedItems | null = null;

export function getCachedReadItems(): MediaItem[] | null {
  if (!cache) return null;
  if (Date.now() - cache.timestamp > TTL_MS) {
    cache = null;
    return null;
  }
  return cache.data;
}

export function setCachedReadItems(data: MediaItem[]): void {
  cache = { data, timestamp: Date.now() };
}

export function invalidateReadItemsCache(): void {
  cache = null;
}
