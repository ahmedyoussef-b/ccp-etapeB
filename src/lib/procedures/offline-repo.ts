import { TProcedure } from "./services/validator.service";
import { mockProcedures } from "./mock-data";

const STORAGE_KEY = "nexaflow_procedures";

function delay(ms: number = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadFromStorage(): TProcedure[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface ProcedureRepository {
  getAll(): Promise<TProcedure[]>;
  getById(code: string): Promise<TProcedure | null>;
  save(procedure: TProcedure): Promise<void>;
  delete(code: string): Promise<void>;
}

export const offlineRepo: ProcedureRepository = {
  getAll: async (): Promise<TProcedure[]> => {
    await delay(200);
    const stored = loadFromStorage();
    if (stored.length > 0) return stored;
    return [...mockProcedures];
  },

  getById: async (code: string): Promise<TProcedure | null> => {
    await delay(200);
    const stored = loadFromStorage();
    const fromStorage = stored.find((p) => p.metadata.code === code) || null;
    if (fromStorage) return fromStorage;
    return mockProcedures.find((p) => p.metadata.code === code) || null;
  },

  save: async (procedure: TProcedure): Promise<void> => {
    await delay(200);
    const stored = loadFromStorage();
    const idx = stored.findIndex((p) => p.metadata.code === procedure.metadata.code);
    if (idx >= 0) {
      stored[idx] = procedure;
    } else {
      stored.push(procedure);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  },

  delete: async (code: string): Promise<void> => {
    await delay(200);
    const stored = loadFromStorage().filter((p) => p.metadata.code !== code);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  },
};
