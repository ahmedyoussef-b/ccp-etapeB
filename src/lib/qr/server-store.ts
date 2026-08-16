import fs from "fs";
import path from "path";
import os from "os";
import { PrismaClient } from "@prisma/client";
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

function generateId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
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

function toPairWithRegistryFromPrisma(
  p: {
    id: number;
    question: string;
    answer: string;
    order: number;
    registryId: number;
    createdAt: Date | string;
    updatedAt: Date | string;
    registry: {
      id: number;
      title: string;
      description: string | null;
      createdAt: Date | string;
      updatedAt: Date | string;
    } | null;
  }
): QAPairWithRegistry {
  return {
    id: p.id,
    question: p.question,
    answer: p.answer,
    registryId: p.registryId,
    order: p.order ?? 0,
    createdAt: new Date(p.createdAt).toISOString(),
    updatedAt: new Date(p.updatedAt).toISOString(),
    registry: {
      id: p.registry?.id ?? 0,
      title: p.registry?.title ?? "unknown",
      description: p.registry?.description ?? null,
      createdAt: p.registry ? new Date(p.registry.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: p.registry ? new Date(p.registry.updatedAt).toISOString() : new Date().toISOString(),
    },
  };
}

async function prismaOrFallback<T>(
  operation: (p: PrismaClient) => Promise<T>,
  fallback: () => T
): Promise<T> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const result = await operation(prisma);
    console.log("[Q/R] Prisma operation succeeded");
    return result;
  } catch (err: unknown) {
    console.warn("[Q/R] Prisma failed, using file-based fallback:", (err as Error)?.message);
    return fallback();
  }
}

export async function getAllPairs(): Promise<QAPairWithRegistry[]> {
  return prismaOrFallback(
    async (prisma) => {
      const rows = await prisma.qAPair.findMany({
        orderBy: { createdAt: "desc" },
        include: { registry: true },
      });
      return rows.map(toPairWithRegistryFromPrisma);
    },
    () => readPairs()
      .map(toPairWithRegistry)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );
}

export async function getRegistries(): Promise<QARegistryRecord[]> {
  return prismaOrFallback(
    async (prisma) => {
      const rows = await prisma.qARegistry.findMany({
        orderBy: { title: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description ?? null,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString(),
      }));
    },
    () => {
      const pairs = readPairs();
      const titles = Array.from(new Set(pairs.map((p) => p.registryTitle)));
      return titles.map((t) => toRegistryRecord(t));
    }
  );
}

export async function getPairById(id: number): Promise<QAPairWithRegistry | null> {
  return prismaOrFallback(
    async (prisma) => {
      const row = await prisma.qAPair.findUnique({
        where: { id },
        include: { registry: true },
      });
      return row ? toPairWithRegistryFromPrisma(row) : null;
    },
    () => {
      const pairs = readPairs();
      const doc = pairs.find((p) => p.id === id);
      return doc ? toPairWithRegistry(doc) : null;
    }
  );
}

export async function findPairByQuestion(question: string): Promise<QAPairWithRegistry | null> {
  return prismaOrFallback(
    async (prisma) => {
      const row = await prisma.qAPair.findFirst({
        where: { question },
        include: { registry: true },
        orderBy: { createdAt: "desc" },
      });
      return row ? toPairWithRegistryFromPrisma(row) : null;
    },
    () => {
      const pairs = readPairs();
      const doc = pairs.find((p) => p.question === question);
      return doc ? toPairWithRegistry(doc) : null;
    }
  );
}

export interface CreatePairInput {
  question: string;
  answer: string;
  registryTitle?: string;
  registryDescription?: string;
}

export async function createPair(input: CreatePairInput): Promise<QAPairWithRegistry> {
  return prismaOrFallback(
    async (prisma) => {
      const title = input.registryTitle || slugify(input.question);
      let registry = await prisma.qARegistry.findFirst({
        where: { title },
      });
      if (!registry) {
        registry = await prisma.qARegistry.create({
          data: {
            title,
            description: input.registryDescription ?? null,
          },
        });
      }

      const row = await prisma.qAPair.create({
        data: {
          question: input.question.trim(),
          answer: input.answer.trim(),
          order: 0,
          registryId: registry.id,
        },
        include: { registry: true },
      });

      return toPairWithRegistryFromPrisma(row);
    },
    () => {
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
      return toPairWithRegistry(doc);
    }
  );
}

export async function updatePair(
  id: number,
  updates: { question?: string; answer?: string; registryId?: number }
): Promise<QAPairWithRegistry | null> {
  return prismaOrFallback(
    async (prisma) => {
      try {
        const row = await prisma.qAPair.update({
          where: { id },
          data: {
            ...(updates.question && { question: updates.question }),
            ...(updates.answer && { answer: updates.answer }),
            ...(updates.registryId && { registryId: updates.registryId }),
          },
          include: { registry: true },
        });
        return toPairWithRegistryFromPrisma(row);
      } catch (err: unknown) {
        if (isPrismaNotFound(err)) return null;
        throw err;
      }
    },
    () => {
      const pairs = readPairs();
      const idx = pairs.findIndex((p) => p.id === id);
      if (idx === -1) return null;

      if (updates.question) pairs[idx].question = updates.question;
      if (updates.answer) pairs[idx].answer = updates.answer;
      pairs[idx].updatedAt = new Date().toISOString();

      writePairs(pairs);
      return toPairWithRegistry(pairs[idx]);
    }
  );
}

function isPrismaNotFound(err: unknown): boolean {
  if (typeof err === "object" && err !== null && "code" in err) {
    return (err as { code: string }).code === "P2025";
  }
  return false;
}

export async function deletePair(id: number): Promise<boolean> {
  return prismaOrFallback(
    async (prisma) => {
      try {
        await prisma.qAPair.delete({ where: { id } });
        return true;
      } catch (err: unknown) {
        if (isPrismaNotFound(err)) return false;
        throw err;
      }
    },
    () => {
      const pairs = readPairs();
      const filtered = pairs.filter((p) => p.id !== id);
      if (filtered.length === pairs.length) return false;
      writePairs(filtered);
      return true;
    }
  );
}

export async function searchPairs(query: string, limit = 10): Promise<QAResult[]> {
  if (!query.trim()) return [];

  const pairs = await getAllPairs();
  if (pairs.length === 0) return [];

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
  const itemsDir = getItemsDir();
  if (!fs.existsSync(itemsDir)) {
    fs.mkdirSync(itemsDir, { recursive: true });
  }

  const ts = new Date().toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "");
  const filename = `qa_${ts}.json`;
  const filepath = path.join(itemsDir, filename);

  const registryTitle = title || slugify(pair.question);

  const doc = {
    type: "qa" as const,
    title: registryTitle,
    description: "",
    pairs: [{ question: pair.question, answer: pair.answer }],
    createdAt: new Date().toISOString(),
    registryPath: `items/${filename}`,
  };

  try {
    fs.writeFileSync(filepath, JSON.stringify(doc, null, 2), "utf-8");
  } catch (err) {
    console.error("[Q/R] exportPairAsJson FAILED:", err);
    throw err;
  }
  return filename;
}

export async function exportPairsAsJson(
  pairs: { question: string; answer: string }[],
  filename: string,
  title?: string
): Promise<string> {
  const itemsDir = getItemsDir();
  if (!fs.existsSync(itemsDir)) {
    fs.mkdirSync(itemsDir, { recursive: true });
  }

  let baseName = filename.replace(/\.json$/, '').trim();
  if (!baseName) {
    baseName = `export_qr_${new Date().toISOString().replace(/[:.]/g, '-')}`;
  }

  const fileExt = '.json';
  const directFilePath = path.join(itemsDir, baseName + fileExt);
  const dirPath = path.join(itemsDir, baseName);

  let targetFilePath = directFilePath;
  let targetRelativePath = `items/${baseName}${fileExt}`;

  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    const files = fs.readdirSync(dirPath);
    let maxIndex = 0;
    for (const f of files) {
      const match = f.match(new RegExp(`^${baseName}_(\\d+)\\.json$`));
      if (match) {
        const idx = parseInt(match[1], 10);
        if (idx > maxIndex) maxIndex = idx;
      }
    }
    const nextIndex = maxIndex + 1;
    targetFilePath = path.join(dirPath, `${baseName}_${nextIndex}${fileExt}`);
    targetRelativePath = `items/${baseName}/${baseName}_${nextIndex}${fileExt}`;
  } else if (fs.existsSync(directFilePath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    
    const oldFileNewPath = path.join(dirPath, `${baseName}_1${fileExt}`);
    fs.renameSync(directFilePath, oldFileNewPath);

    targetFilePath = path.join(dirPath, `${baseName}_2${fileExt}`);
    targetRelativePath = `items/${baseName}/${baseName}_2${fileExt}`;
  }

  const registryTitle = title || baseName;

  const doc = {
    type: "qa" as const,
    title: registryTitle,
    description: "",
    pairs: pairs.map(p => ({ question: p.question, answer: p.answer })),
    createdAt: new Date().toISOString(),
    registryPath: targetRelativePath,
  };

  try {
    fs.writeFileSync(targetFilePath, JSON.stringify(doc, null, 2), "utf-8");
  } catch (err) {
    console.error("[Q/R] exportPairsAsJson FAILED:", err);
    throw err;
  }
  return path.basename(targetFilePath);
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
        const doc: QAPairDoc = {
          id: generateId(),
          question: pair.question,
          answer: pair.answer,
          registryTitle: title,
          createdAt: parsed.createdAt || new Date().toISOString(),
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };

        existing.push(doc);
        existingIds.add(doc.id);
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
