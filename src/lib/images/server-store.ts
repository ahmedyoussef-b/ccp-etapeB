import fs from "fs";
import path from "path";

const DB_DIR = path.join(process.cwd(), ".local-db", "images");
const DB_FILE = path.join(DB_DIR, "items.json");

function ensureDir(): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function readItems(): MediaItem[] {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeItems(items: MediaItem[]): void {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(items, null, 2), "utf-8");
}

export interface MediaItem {
  id: string;
  title: string;
  category: string;
  description: string;
  tags: string[];
  kind: "image" | "video";
  mimeType: string;
  size: number;
  dataUrl: string;
  thumbnailDataUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export function generateId(): string {
  return `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function getAll(): Promise<MediaItem[]> {
  await delay(50);
  return readItems();
}

export async function getById(id: string): Promise<MediaItem | undefined> {
  await delay(30);
  const items = readItems();
  return items.find((item) => item.id === id);
}

export async function create(item: Omit<MediaItem, "id" | "createdAt" | "updatedAt">): Promise<MediaItem> {
  await delay(50);
  const now = new Date().toISOString();
  const newItem: MediaItem = {
    ...item,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  const items = readItems();
  items.unshift(newItem);
  writeItems(items);
  return newItem;
}

export async function update(
  id: string,
  updates: Partial<Omit<MediaItem, "id" | "createdAt">>
): Promise<MediaItem | undefined> {
  await delay(50);
  const items = readItems();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return undefined;
  items[index] = {
    ...items[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeItems(items);
  return items[index];
}

export async function remove(id: string): Promise<boolean> {
  await delay(50);
  const items = readItems();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return false;
  items.splice(index, 1);
  writeItems(items);
  return true;
}

export async function getCategories(): Promise<string[]> {
  await delay(30);
  const items = readItems();
  const cats = new Set<string>();
  items.forEach((item) => cats.add(item.category));
  return ["Tous", ...Array.from(cats).sort()];
}

function delay(ms = 30): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}