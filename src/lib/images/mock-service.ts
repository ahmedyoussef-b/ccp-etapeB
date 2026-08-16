export type MediaKind = "image" | "video";

export interface MediaItem {
  id: string;
  title: string;
  category: string;
  description: string;
  tags: string[];
  kind: MediaKind;
  mimeType: string;
  size: number;
  dataUrl: string;
  thumbnailDataUrl?: string;
  geolocation?: { lat: number; lng: number };
  createdAt: string;
  updatedAt: string;
}

const API_BASE = "/api/images";

function delay(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

function buildApiUrl(params?: { limit?: number; offset?: number; sortBy?: string; sortOrder?: string; q?: string; category?: string }): string {
  const url = new URL(API_BASE, "http://localhost");
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  if (params?.offset) url.searchParams.set("offset", String(params.offset));
  if (params?.sortBy) url.searchParams.set("sortBy", params.sortBy);
  if (params?.sortOrder) url.searchParams.set("sortOrder", params.sortOrder);
  if (params?.q) url.searchParams.set("q", params.q);
  if (params?.category && params.category !== "Tous") url.searchParams.set("category", params.category);
  return url.pathname + url.search;
}

export const imageService = {
  async init(): Promise<void> {
    await delay(100);
    console.log("[ImageService] init() - service initialized");
  },

  async getAll(params?: { limit?: number; offset?: number; sortBy?: string; sortOrder?: string; q?: string; category?: string }): Promise<{ items: MediaItem[]; total: number }> {
    const url = buildApiUrl(params);
    console.log(`[ImageService] getAll() - GET ${url}`);
    await delay();
    const data = await fetchJson<{ items: MediaItem[]; total: number }>(url);
    console.log(`[ImageService] getAll() - received ${data.items.length}/${data.total} items`);
    return data;
  },

  async getById(id: string): Promise<MediaItem | undefined> {
    console.log(`[ImageService] getById() - GET ${API_BASE}/${id}`);
    await delay();
    const item = await fetchJson<MediaItem>(`${API_BASE}/${id}`);
    console.log(`[ImageService] getById() - found item: ${item?.title || "null"}`);
    return item;
  },

  async create(item: Omit<MediaItem, "id" | "createdAt" | "updatedAt">): Promise<MediaItem> {
    console.log(`[ImageService] create() - POST ${API_BASE} | title="${item.title}" category="${item.category}" kind=${item.kind} size=${formatBytes(item.size)}`);
    await delay();
    const result = await fetchJson<MediaItem>(API_BASE, {
      method: "POST",
      body: JSON.stringify(item),
    });
    console.log(`[ImageService] create() - created item id=${result.id}`);
    return result;
  },

  async update(id: string, updates: Partial<Omit<MediaItem, "id" | "createdAt">>): Promise<MediaItem | undefined> {
    console.log(`[ImageService] update() - PUT ${API_BASE}/${id} | fields=${Object.keys(updates).join(",")}`);
    await delay();
    const result = await fetchJson<MediaItem>(`${API_BASE}/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    console.log(`[ImageService] update() - updated item: ${result?.title || "null"}`);
    return result;
  },

  async delete(id: string): Promise<boolean> {
    console.log(`[ImageService] delete() - DELETE ${API_BASE}/${id}`);
    await delay();
    const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    console.log(`[ImageService] delete() - result=${res.ok}`);
    return res.ok;
  },

  async getCategories(): Promise<string[]> {
    console.log(`[ImageService] getCategories() - GET ${API_BASE}`);
    await delay();
    const data = await fetchJson<{ categories: string[] }>(API_BASE);
    console.log(`[ImageService] getCategories() - categories=[${data.categories.join(", ")}]`);
    return data.categories;
  },

  async getCount(): Promise<number> {
    console.log(`[ImageService] getCount()`);
    const data = await this.getAll();
    const count = data.total;
    console.log(`[ImageService] getCount() - total=${count}`);
    return count;
  },

  async getTotalSize(): Promise<string> {
    console.log(`[ImageService] getTotalSize()`);
    const data = await this.getAll();
    const bytes = data.items.reduce((acc, item) => acc + item.size, 0);
    const formatted = bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    console.log(`[ImageService] getTotalSize() - ${formatted}`);
    return formatted;
  },

  async bulkDelete(ids: string[]): Promise<boolean> {
    console.log(`[ImageService] bulkDelete() - DELETE ${API_BASE}/bulk | ids=[${ids.join(",")}]`);
    await delay();
    const res = await fetch(`${API_BASE}/bulk`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    console.log(`[ImageService] bulkDelete() - result=${res.ok}`);
    return res.ok;
  },

  async bulkTag(ids: string[], tags: string[]): Promise<boolean> {
    console.log(`[ImageService] bulkTag() - PATCH ${API_BASE}/bulk | ids=[${ids.length} items] tags=[${tags.join(",")}]`);
    await delay();
    const res = await fetch(`${API_BASE}/bulk`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, tags }),
    });
    console.log(`[ImageService] bulkTag() - result=${res.ok}`);
    return res.ok;
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
