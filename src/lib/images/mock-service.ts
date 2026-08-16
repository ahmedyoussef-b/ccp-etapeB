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
  },

  async getAll(params?: { limit?: number; offset?: number; sortBy?: string; sortOrder?: string; q?: string; category?: string }): Promise<{ items: MediaItem[]; total: number }> {
    await delay();
    const url = buildApiUrl(params);
    const data = await fetchJson<{ items: MediaItem[]; total: number }>(url);
    return data;
  },

  async getById(id: string): Promise<MediaItem | undefined> {
    await delay();
    const item = await fetchJson<MediaItem>(`${API_BASE}/${id}`);
    return item;
  },

  async create(item: Omit<MediaItem, "id" | "createdAt" | "updatedAt">): Promise<MediaItem> {
    await delay();
    return fetchJson<MediaItem>(API_BASE, {
      method: "POST",
      body: JSON.stringify(item),
    });
  },

  async update(id: string, updates: Partial<Omit<MediaItem, "id" | "createdAt">>): Promise<MediaItem | undefined> {
    await delay();
    return fetchJson<MediaItem>(`${API_BASE}/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string): Promise<boolean> {
    await delay();
    const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    return res.ok;
  },

  async getCategories(): Promise<string[]> {
    await delay();
    const data = await fetchJson<{ categories: string[] }>(API_BASE);
    return data.categories;
  },

  async getCount(): Promise<number> {
    await delay();
    const data = await this.getAll();
    return data.total;
  },

  async getTotalSize(): Promise<string> {
    await delay();
    const data = await this.getAll();
    const bytes = data.items.reduce((acc, item) => acc + item.size, 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },

  async bulkDelete(ids: string[]): Promise<boolean> {
    await delay();
    const res = await fetch(`${API_BASE}/bulk`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    return res.ok;
  },

  async bulkTag(ids: string[], tags: string[]): Promise<boolean> {
    await delay();
    const res = await fetch(`${API_BASE}/bulk`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, tags }),
    });
    return res.ok;
  },
};
