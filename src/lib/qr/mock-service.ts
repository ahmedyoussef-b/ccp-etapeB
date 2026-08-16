import type { QAPairWithRegistry, QARegistryRecord } from "@/lib/qr/server-store";
import type { QAResult } from "@/lib/qr/scoring";

const API_BASE = "/api/qr";

async function delay(ms = 150): Promise<void> {
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

export const qrService = {
  async init(): Promise<void> {
    await delay(100);
  },

  async getAll(): Promise<QAPairWithRegistry[]> {
    await delay();
    const data = await fetchJson<{ pairs: QAPairWithRegistry[] }>(API_BASE);
    return data.pairs;
  },

  async getRegistries(): Promise<QARegistryRecord[]> {
    await delay();
    const data = await fetchJson<{ registries: QARegistryRecord[] }>(`${API_BASE}/search`);
    return data.registries;
  },

  async getById(id: number): Promise<QAPairWithRegistry> {
    await delay();
    return fetchJson<QAPairWithRegistry>(`${API_BASE}/${id}`);
  },

  async create(pair: {
    question: string;
    answer: string;
    registryTitle?: string;
    registryDescription?: string;
  }): Promise<QAPairWithRegistry> {
    await delay();
    return fetchJson<QAPairWithRegistry>(API_BASE, {
      method: "POST",
      body: JSON.stringify(pair),
    });
  },

  async update(
    id: number,
    updates: { question?: string; answer?: string; registryId?: number }
  ): Promise<QAPairWithRegistry> {
    await delay();
    return fetchJson<QAPairWithRegistry>(`${API_BASE}/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  async delete(id: number): Promise<void> {
    await delay();
    await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
  },

  async search(query: string): Promise<QAResult[]> {
    await delay();
    const data = await fetchJson<{ results: QAResult[] }>(
      `${API_BASE}/search?q=${encodeURIComponent(query)}`
    );
    return data.results;
  },

  async send(item: {
    question: string;
    answer: string;
  }): Promise<{ filename: string; pairId: number }> {
    await delay();
    console.log("[Q/R client] send() calling /api/qr/export");
    return fetchJson<{ filename: string; pairId: number }>(`${API_BASE}/export`, {
      method: "POST",
      body: JSON.stringify(item),
    });
  },
};
