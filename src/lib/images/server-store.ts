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
  geolocation?: { lat: number; lng: number };
  createdAt: string;
  updatedAt: string;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp", "image/svg+xml"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function validateMediaItem(item: Partial<MediaItem>): string | null {
  if (!item.title?.trim()) return "Le titre est requis";
  if (!item.category?.trim()) return "La catégorie est requise";
  if (!item.dataUrl?.trim()) return "Le média est requis";
  if (!item.mimeType?.trim()) return "Le type MIME est requis";
  if (item.size && item.size > MAX_FILE_SIZE) return `Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`;
  if (!ALLOWED_MIME_TYPES.includes(item.mimeType)) return `Type de fichier non autorisé: ${item.mimeType}`;
  return null;
}

function sortItems(items: MediaItem[], sortBy: string, sortOrder: "asc" | "desc"): MediaItem[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    let aVal: string | number = a[sortBy as keyof MediaItem] as string | number;
    let bVal: string | number = b[sortBy as keyof MediaItem] as string | number;
    if (sortBy === "size") {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
    } else if (typeof aVal === "string") {
      aVal = aVal.toLowerCase();
      bVal = (bVal as string).toLowerCase();
    }
    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });
  return sorted;
}

function searchItems(items: MediaItem[], query: string): MediaItem[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase().trim();
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

export function generateId(): string {
  return `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function getAll(): Promise<MediaItem[]> {
  await delay(50);
  return readItems();
}

export async function getAllPaginated(params?: { limit?: number; offset?: number; sortBy?: string; sortOrder?: string; q?: string; category?: string }): Promise<{ items: MediaItem[]; total: number }> {
  await delay(50);
  let items = readItems();

  if (params?.category && params.category !== "Tous") {
    items = items.filter((item) => item.category === params.category);
  }

  if (params?.q?.trim()) {
    items = searchItems(items, params.q);
  }

  const total = items.length;
  const sortOrder = (params?.sortOrder === "asc" ? "asc" : "desc") as "asc" | "desc";
  items = sortItems(items, params?.sortBy || "createdAt", sortOrder);

  const limit = params?.limit || items.length;
  const offset = params?.offset || 0;
  const paginated = items.slice(offset, offset + limit);

  return { items: paginated, total };
}

export async function getById(id: string): Promise<MediaItem | undefined> {
  await delay(30);
  const items = readItems();
  return items.find((item) => item.id === id);
}

export async function create(item: Omit<MediaItem, "id" | "createdAt" | "updatedAt">): Promise<MediaItem> {
  const validationError = validateMediaItem(item);
  if (validationError) {
    throw new Error(validationError);
  }
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
  const validationError = validateMediaItem(updates);
  if (validationError) {
    throw new Error(validationError);
  }
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

export async function bulkDelete(ids: string[]): Promise<boolean> {
  await delay(50);
  if (!ids.length) return false;
  const items = readItems();
  const filtered = items.filter((item) => !ids.includes(item.id));
  if (filtered.length === items.length) return false;
  writeItems(filtered);
  return true;
}

export async function bulkTag(ids: string[], tagsToAdd: string[]): Promise<boolean> {
  await delay(50);
  if (!ids.length || !tagsToAdd.length) return false;
  const items = readItems();
  let changed = false;
  items.forEach((item) => {
    if (ids.includes(item.id)) {
      const newTags = Array.from(new Set([...item.tags, ...tagsToAdd]));
      if (newTags.length !== item.tags.length) {
        item.tags = newTags;
        changed = true;
      }
    }
  });
  if (!changed) return false;
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
