import fs from "fs";
import path from "path";
import os from "os";
import { rankResults, computeWordScore, type QAResult } from "./scoring";

export interface QARegistryRecord {
  id: number;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QAPairRecord {
  id: number;
  question: string;
  answer: string;
  registryId: number;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface QAPairWithRegistry extends QAPairRecord {
  registry: QARegistryRecord;
}

interface QAPairDoc {
  id: number;
  question: string;
  answer: string;
  registryTitle: string;
  createdAt: string;
  updatedAt: string;
}

interface ParsedQAPair {
  question: string;
  answer: string;
}

interface ParsedQAFile {
  type: string;
  title?: string;
  description?: string;
  pairs: ParsedQAPair[];
  createdAt?: string;
  updatedAt?: string;
}

const DB_DIR = path.join(process.cwd(), ".local-db", "qr");
const ITEMS_DIR = path.join(process.cwd(), ".data", "registry", "items");
const TMP_DB_DIR = path.join(os.tmpdir(), ".local-db", "qr");
const TMP_ITEMS_DIR = path.join(os.tmpdir(), ".data", "registry", "items");

let resolvedDbDir: string | null = null;
let resolvedItemsDir: string | null = null;

function getDbDir(): string {
  if (resolvedDbDir) return resolvedDbDir;
  resolvedDbDir = resolveWritableDir(DB_DIR, TMP_DB_DIR);
  return resolvedDbDir;
}

function getItemsDir(): string {
  if (resolvedItemsDir) return resolvedItemsDir;
  resolvedItemsDir = resolveWritableDir(ITEMS_DIR, TMP_ITEMS_DIR);
  return resolvedItemsDir;
}

function resolveWritableDir(preferred: string, fallback: string): string {
  try {
    if (!fs.existsSync(preferred)) {
      fs.mkdirSync(preferred, { recursive: true });
    }
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch {
    try {
      if (!fs.existsSync(fallback)) {
        fs.mkdirSync(fallback, { recursive: true });
      }
      return fallback;
    } catch {
      return preferred;
    }
  }
}

function ensureDir(): void {
  const dir = getDbDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function pairsFile(): string {
  return path.join(getDbDir(), "pairs.json");
}

function readPairs(): QAPairDoc[] {
  ensureDir();
  const file = pairsFile();
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePairs(pairs: QAPairDoc[]): void {
  ensureDir();
  fs.writeFileSync(pairsFile(), JSON.stringify(pairs, null, 2), "utf-8");
}

function generateId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .substring(0, 60) || `qa-${Date.now()}`;
}

function toRegistryRecord(title: string): QARegistryRecord {
  return {
    id: 0,
    title,
    description: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function toPairWithRegistry(doc: QAPairDoc): QAPairWithRegistry {
  return {
    id: doc.id,
    question: doc.question,
    answer: doc.answer,
    registryId: 0,
    order: 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    registry: toRegistryRecord(doc.registryTitle),
  };
}

export async function getAllPairs(): Promise<QAPairWithRegistry[]> {
  return readPairs().map(toPairWithRegistry).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getRegistries(): Promise<QARegistryRecord[]> {
  const pairs = readPairs();
  const titles = Array.from(new Set(pairs.map((p) => p.registryTitle)));
  return titles.map((t) => toRegistryRecord(t));
}

export async function getPairById(id: number): Promise<QAPairWithRegistry | null> {
  const pairs = readPairs();
  const doc = pairs.find((p) => p.id === id);
  return doc ? toPairWithRegistry(doc) : null;
}

export interface CreatePairInput {
  question: string;
  answer: string;
  registryTitle?: string;
  registryDescription?: string;
}

export async function createPair(input: CreatePairInput): Promise<QAPairWithRegistry> {
  const pairs = readPairs();
  const title = input.registryTitle || slugify(input.question);

  const doc: QAPairDoc = {
    id: generateId(),
    question: input.question.trim(),
    answer: input.answer.trim(),
    registryTitle: title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  pairs.push(doc);
  writePairs(pairs);

  syncToWebDb("create", doc).catch(() => {});

  return toPairWithRegistry(doc);
}

export async function updatePair(
  id: number,
  updates: { question?: string; answer?: string; registryId?: number }
): Promise<QAPairWithRegistry | null> {
  const pairs = readPairs();
  const idx = pairs.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  if (updates.question) pairs[idx].question = updates.question;
  if (updates.answer) pairs[idx].answer = updates.answer;
  pairs[idx].updatedAt = new Date().toISOString();

  writePairs(pairs);
  syncToWebDb("create", pairs[idx]).catch(() => {});

  return toPairWithRegistry(pairs[idx]);
}

export async function deletePair(id: number): Promise<boolean> {
  const pairs = readPairs();
  const filtered = pairs.filter((p) => p.id !== id);
  if (filtered.length === pairs.length) return false;
  writePairs(filtered);
  syncToWebDb("delete", { id }).catch(() => {});
  return true;
}

export async function searchPairs(query: string, limit = 10): Promise<QAResult[]> {
  const pairs = readPairs();
  if (!query.trim() || pairs.length === 0) return [];

  const results = pairs.map((p) => ({
    question: p.question,
    answer: p.answer,
    score: computeWordScore(query, p.question),
  }));

  return rankResults(query, results).slice(0, limit);
}

export async function exportPairAsJson(
  pair: { question: string; answer: string },
  title?: string
): Promise<string> {
  if (!fs.existsSync(getItemsDir())) {
    fs.mkdirSync(getItemsDir(), { recursive: true });
  }

  const ts = new Date().toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "");
  const filename = `qa_${ts}.json`;
  const filepath = path.join(getItemsDir(), filename);

  const registryTitle = title || slugify(pair.question);

  const doc = {
    type: "qa" as const,
    title: registryTitle,
    description: "",
    pairs: [{ question: pair.question, answer: pair.answer }],
    createdAt: new Date().toISOString(),
    registryPath: `items/${filename}`,
  };

  fs.writeFileSync(filepath, JSON.stringify(doc, null, 2), "utf-8");
  return filename;
}

async function syncToWebDb(
  action: "create" | "delete",
  doc: QAPairDoc | { id: number }
): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    if (action === "create") {
      const pairDoc = doc as QAPairDoc;
      let registry = await prisma.qARegistry.findFirst({
        where: { title: pairDoc.registryTitle },
      });
      if (!registry) {
        registry = await prisma.qARegistry.create({
          data: {
            title: pairDoc.registryTitle,
            description: null,
          },
        });
      }
      await prisma.qAPair.upsert({
        where: { id: pairDoc.id },
        update: {
          question: pairDoc.question,
          answer: pairDoc.answer,
          registryId: registry.id,
        },
        create: {
          id: pairDoc.id,
          question: pairDoc.question,
          answer: pairDoc.answer,
          order: 0,
          registryId: registry.id,
        },
      });
    } else {
      await prisma.qAPair.deleteMany({ where: { id: (doc as { id: number }).id } });
    }
  } catch {
    // Web DB unavailable — file-based storage is the source of truth
  }
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

export async function importRegistryFiles(): Promise<ImportResult> {
  let imported = 0;
  let skipped = 0;

  const itemsDir = getItemsDir();
  if (!fs.existsSync(itemsDir)) {
    return { imported, skipped };
  }

  const existing = readPairs();
  const existingIds = new Set(existing.map((p) => p.id));

  const entries = fs.readdirSync(itemsDir);
  for (const entry of entries) {
    const fullPath = path.join(itemsDir, entry);
    if (!fs.statSync(fullPath).isFile() || !entry.endsWith(".json")) continue;

    try {
      const raw = fs.readFileSync(fullPath, "utf-8");
      const parsed: ParsedQAFile = JSON.parse(raw);
      if (
        parsed.type !== "qa" ||
        !Array.isArray(parsed.pairs) ||
        parsed.pairs.length === 0
      ) {
        skipped++;
        continue;
      }

      const title = parsed.title || entry.replace(".json", "");

      for (const pair of parsed.pairs) {
        const newId = generateId();
        while (existingIds.has(newId)) {
          void generateId();
        }

        const doc: QAPairDoc = {
          id: newId,
          question: pair.question,
          answer: pair.answer,
          registryTitle: title,
          createdAt: parsed.createdAt || new Date().toISOString(),
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };

        existing.push(doc);
        existingIds.add(newId);
        imported++;
      }
    } catch {
      skipped++;
    }
  }

  if (imported > 0) {
    writePairs(existing);
  }

  return { imported, skipped };
}
