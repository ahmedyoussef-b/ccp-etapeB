import type { EtatDesLieuxReport } from "./server-store";

const API_BASE = "/api/etat-des-lieux";

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

export const etatDesLieuxService = {
  async init(): Promise<void> {
    await delay(100);
  },

  async getAll(): Promise<EtatDesLieuxReport[]> {
    await delay();
    const data = await fetchJson<{ reports: EtatDesLieuxReport[] }>(API_BASE);
    return data.reports;
  },

  async getById(id: string): Promise<EtatDesLieuxReport | undefined> {
    await delay();
    const report = await fetchJson<EtatDesLieuxReport>(`${API_BASE}/${id}`);
    return report;
  },

  async create(report: Omit<EtatDesLieuxReport, "id" | "createdAt" | "updatedAt">): Promise<EtatDesLieuxReport> {
    await delay();
    return fetchJson<EtatDesLieuxReport>(API_BASE, {
      method: "POST",
      body: JSON.stringify(report),
    });
  },

  async update(id: string, updates: Partial<Omit<EtatDesLieuxReport, "id" | "createdAt">>): Promise<EtatDesLieuxReport | undefined> {
    await delay();
    return fetchJson<EtatDesLieuxReport>(`${API_BASE}/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string): Promise<boolean> {
    await delay();
    const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    return res.ok;
  },
};
