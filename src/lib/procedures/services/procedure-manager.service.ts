import { ProcedureSchema, TProcedure, TStep } from "@/lib/procedures/services/validator.service";
import { csrfFetch } from "@/lib/procedures/csrf-fetch";

const STORAGE_KEY = "nexaflow_procedures";
const VERSION_HISTORY_KEY = "nexaflow_procedure_versions";

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

function saveToStorage(procedures: TProcedure[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(procedures));
  } catch {
    // Storage full or unavailable
  }
}

function loadVersionHistory(): Record<string, Array<{ version: string; body: TProcedure; createdAt: string; comment?: string }>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(VERSION_HISTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveVersionHistory(
  history: Record<string, Array<{ version: string; body: TProcedure; createdAt: string; comment?: string }>>
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Storage full or unavailable
  }
}

let cachedProcedures = loadFromStorage();

function bumpVersion(version: string): string {
  const parts = version.split(".").map(Number);
  if (parts.length >= 2 && !isNaN(parts[1])) {
    return `${parts[0]}.${parts[1] + 1}`;
  }
  if (parts.length === 1 && !isNaN(parts[0])) {
    return `${parts[0]}.1`;
  }
  return `${version}.1`;
}

export function getProcedures(): TProcedure[] {
  return [...cachedProcedures];
}

export function getProcedureById(id: string): TProcedure | null {
  return cachedProcedures.find((p) => p.metadata.code === id) ?? null;
}

export function saveProcedure(procedure: TProcedure): void {
  const validated = ProcedureSchema.parse(procedure);
  const idx = cachedProcedures.findIndex((p) => p.metadata.code === validated.metadata.code);
  if (idx >= 0) {
    const existing = cachedProcedures[idx];
    const existingStr = JSON.stringify(existing);
    const newStr = JSON.stringify(validated);
    if (existingStr !== newStr) {
      validated.metadata = {
        ...validated.metadata,
        version: bumpVersion(existing.metadata.version || "1.0"),
      };
    } else {
      validated.metadata = {
        ...validated.metadata,
        version: existing.metadata.version || "1.0",
      };
    }
    cachedProcedures[idx] = validated;
  } else {
    cachedProcedures.push(validated);
  }
  saveToStorage(cachedProcedures);
}

export function deleteProcedure(code: string): void {
  cachedProcedures = cachedProcedures.filter((p) => p.metadata.code !== code);
  saveToStorage(cachedProcedures);
}

export function createEmptyProcedure(): TProcedure {
  return {
    metadata: {
      title: "",
      code: "",
      description: "",
      category: "",
      priority: "moyenne",
      estimatedTimeMinutes: 1,
      requiredRoles: [],
      globalSafetyInstructions: [],
      version: "1.0",
    },
    steps: [],
  };
}

export function addStep(procedure: TProcedure): TProcedure {
  const newStep: TStep = {
    id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    subtitle: "",
    instructions: "",
    type: "consigne_simple",
    isMandatory: false,
    dependencies: [],
    mediaRequirements: [],
    alarms: [],
    attachments: [],
    order: procedure.steps.length,
    timerEnabled: false,
    timerSeconds: 0,
  };
  return {
    ...procedure,
    steps: [...procedure.steps, newStep],
  };
}

export function removeStep(procedure: TProcedure, stepId: string): TProcedure {
  return {
    ...procedure,
    steps: procedure.steps
      .filter((s) => s.id !== stepId)
      .map((s, i) => ({ ...s, order: i })),
  };
}

export function duplicateStep(procedure: TProcedure, stepId: string): TProcedure {
  const idx = procedure.steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return procedure;
  const original = procedure.steps[idx];
  const clone: TStep = {
    ...original,
    id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: `${original.title} (copie)`,
    order: idx + 1,
  };
  const newSteps = [
    ...procedure.steps.slice(0, idx + 1),
    clone,
    ...procedure.steps.slice(idx + 1),
  ].map((s, i) => ({ ...s, order: i }));
  return { ...procedure, steps: newSteps };
}

export function reorderSteps(procedure: TProcedure, fromIndex: number, toIndex: number): TProcedure {
  const newSteps = [...procedure.steps];
  const [moved] = newSteps.splice(fromIndex, 1);
  newSteps.splice(toIndex, 0, moved);
  return {
    ...procedure,
    steps: newSteps.map((s, i) => ({ ...s, order: i })),
  };
}

export function updateStep(procedure: TProcedure, stepId: string, updates: Partial<TStep>): TProcedure {
  return {
    ...procedure,
    steps: procedure.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)),
  };
}

export function updateMetadata(procedure: TProcedure, metadata: Partial<TProcedure["metadata"]>): TProcedure {
  return {
    ...procedure,
    metadata: { ...procedure.metadata, ...metadata },
  };
}

export function importProcedure(procedure: TProcedure): void {
  const validated = ProcedureSchema.parse(procedure);
  const idx = cachedProcedures.findIndex((p) => p.metadata.code === validated.metadata.code);
  if (idx >= 0) {
    cachedProcedures[idx] = validated;
  } else {
    cachedProcedures.push(validated);
  }
  saveToStorage(cachedProcedures);
}

export async function syncToServer(procedure: TProcedure): Promise<{ success: boolean; offline?: boolean }> {
  try {
    const res = await csrfFetch("/api/procedures/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(procedure),
    });
    if (!res.ok) throw new Error(`Sync failed with status ${res.status}`);
    return res.json();
  } catch {
    return { success: false };
  }
}

export function exportToJson(procedure: TProcedure): string {
  return JSON.stringify(ProcedureSchema.parse(procedure), null, 2);
}

export function downloadJson(procedure: TProcedure, filename?: string): void {
  const json = exportToJson(procedure);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `${procedure.metadata.code}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getVersions(code: string): Array<{ version: string; body: TProcedure; createdAt: string; comment?: string }> {
  const history = loadVersionHistory();
  return history[code] ? [...history[code]].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];
}

export function createVersion(code: string, comment?: string): { version: string; body: TProcedure } | null {
  const procedure = cachedProcedures.find((p) => p.metadata.code === code);
  if (!procedure) return null;

  const currentVersion = procedure.metadata.version || "1.0";
  const snapshot = {
    version: currentVersion,
    body: JSON.parse(JSON.stringify(procedure)),
    createdAt: new Date().toISOString(),
    comment: comment || "",
  };

  const history = loadVersionHistory();
  if (!history[code]) {
    history[code] = [];
  }
  history[code].push(snapshot);
  saveVersionHistory(history);

  const updated = {
    ...procedure,
    metadata: {
      ...procedure.metadata,
      version: bumpVersion(currentVersion),
    },
  };

  const idx = cachedProcedures.findIndex((p) => p.metadata.code === code);
  if (idx >= 0) {
    cachedProcedures[idx] = updated;
  }
  saveToStorage(cachedProcedures);

  return { version: currentVersion, body: snapshot.body };
}

export function restoreVersion(code: string, version: string): TProcedure | null {
  const history = loadVersionHistory();
  const versions = history[code];
  if (!versions) return null;

  const target = versions.find((v) => v.version === version);
  if (!target) return null;

  const restored = JSON.parse(JSON.stringify(target.body)) as TProcedure;
  const idx = cachedProcedures.findIndex((p) => p.metadata.code === code);
  if (idx >= 0) {
    cachedProcedures[idx] = restored;
  } else {
    cachedProcedures.push(restored);
  }
  saveToStorage(cachedProcedures);
  return restored;
}
