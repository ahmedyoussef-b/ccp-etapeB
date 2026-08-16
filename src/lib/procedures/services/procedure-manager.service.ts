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
  console.log("[CREER-PROCEDURE] getProcedures: cache length:", cachedProcedures.length);
  return [...cachedProcedures];
}

export function getProcedureById(id: string): TProcedure | null {
  const found = cachedProcedures.find((p) => p.metadata.code === id) ?? null;
  console.log("[CREER-PROCEDURE] getProcedureById:", id, "=>", found ? "trouvé" : "non trouvé");
  return found;
}

export function saveProcedure(procedure: TProcedure): void {
  console.log("[CREER-PROCEDURE] saveProcedure demandé. Code:", procedure.metadata.code, "| Étapes:", procedure.steps.length);
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
      console.log("[CREER-PROCEDURE] saveProcedure: version bumpée vers", validated.metadata.version);
    } else {
      validated.metadata = {
        ...validated.metadata,
        version: existing.metadata.version || "1.0",
      };
      console.log("[CREER-PROCEDURE] saveProcedure: aucun changement, version conservée", validated.metadata.version);
    }
    cachedProcedures[idx] = validated;
  } else {
    console.log("[CREER-PROCEDURE] saveProcedure: nouvelle procédure ajoutée au cache");
    cachedProcedures.push(validated);
  }
  saveToStorage(cachedProcedures);
  console.log("[CREER-PROCEDURE] saveProcedure: sauvegardé dans localStorage. Total cache:", cachedProcedures.length);
}

export function deleteProcedure(code: string): void {
  console.log("[CREER-PROCEDURE] deleteProcedure:", code, "| Avant:", cachedProcedures.length);
  cachedProcedures = cachedProcedures.filter((p) => p.metadata.code !== code);
  saveToStorage(cachedProcedures);
  console.log("[CREER-PROCEDURE] deleteProcedure: après suppression:", cachedProcedures.length);
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
  console.log("[CREER-PROCEDURE] importProcedure:", procedure.metadata.code);
  const validated = ProcedureSchema.parse(procedure);
  const idx = cachedProcedures.findIndex((p) => p.metadata.code === validated.metadata.code);
  if (idx >= 0) {
    cachedProcedures[idx] = validated;
    console.log("[CREER-PROCEDURE] importProcedure: procédure existante remplacée");
  } else {
    cachedProcedures.push(validated);
    console.log("[CREER-PROCEDURE] importProcedure: nouvelle procédure ajoutée");
  }
  saveToStorage(cachedProcedures);
}

export async function syncToServer(procedure: TProcedure): Promise<{ success: boolean; offline?: boolean }> {
  console.log("[CREER-PROCEDURE] syncToServer demandé. Code:", procedure.metadata.code);
  try {
    const res = await csrfFetch("/api/procedures/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(procedure),
    });
    if (!res.ok) {
      console.error("[CREER-PROCEDURE] syncToServer échoué:", res.status);
      throw new Error(`Sync failed with status ${res.status}`);
    }
    const data = await res.json();
    console.log("[CREER-PROCEDURE] syncToServer succès:", data);
    return data;
  } catch (e) {
    console.error("[CREER-PROCEDURE] syncToServer erreur:", e);
    return { success: false };
  }
}

export function exportToJson(procedure: TProcedure): string {
  console.log("[CREER-PROCEDURE] exportToJson:", procedure.metadata.code);
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
  console.log("[CREER-PROCEDURE] downloadJson: fichier téléchargé:", filename || `${procedure.metadata.code}.json`);
}

export function getVersions(code: string): Array<{ version: string; body: TProcedure; createdAt: string; comment?: string }> {
  const history = loadVersionHistory();
  const versions = history[code] ? [...history[code]].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];
  console.log("[CREER-PROCEDURE] getVersions:", code, "=>", versions.length, "versions");
  return versions;
}

export function createVersion(code: string, comment?: string): { version: string; body: TProcedure } | null {
  console.log("[CREER-PROCEDURE] createVersion demandé:", code, "| Commentaire:", comment);
  const procedure = cachedProcedures.find((p) => p.metadata.code === code);
  if (!procedure) {
    console.warn("[CREER-PROCEDURE] createVersion: procédure introuvable:", code);
    return null;
  }

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

  console.log("[CREER-PROCEDURE] createVersion: snapshot créé pour", code, "version:", currentVersion);
  return { version: currentVersion, body: snapshot.body };
}

export function restoreVersion(code: string, version: string): TProcedure | null {
  console.log("[CREER-PROCEDURE] restoreVersion demandé:", code, "version:", version);
  const history = loadVersionHistory();
  const versions = history[code];
  if (!versions) {
    console.warn("[CREER-PROCEDURE] restoreVersion: aucun historique pour", code);
    return null;
  }

  const target = versions.find((v) => v.version === version);
  if (!target) {
    console.warn("[CREER-PROCEDURE] restoreVersion: version introuvable:", version);
    return null;
  }

  const restored = JSON.parse(JSON.stringify(target.body)) as TProcedure;
  const idx = cachedProcedures.findIndex((p) => p.metadata.code === code);
  if (idx >= 0) {
    cachedProcedures[idx] = restored;
    console.log("[CREER-PROCEDURE] restoreVersion: procédure existante remplacée");
  } else {
    cachedProcedures.push(restored);
    console.log("[CREER-PROCEDURE] restoreVersion: procédure ajoutée au cache");
  }
  saveToStorage(cachedProcedures);
  return restored;
}
