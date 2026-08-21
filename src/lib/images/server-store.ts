import fs from "fs";
import path from "path";

const NORMAL_DB_DIR = path.join(process.cwd(), ".local-db", "images");
const TMP_DB_DIR = path.join("/tmp", ".local-db", "images");

let resolvedDbDir: string | null = null;

function getDbDir(): string {
  if (resolvedDbDir) return resolvedDbDir;

  const candidates = [NORMAL_DB_DIR, TMP_DB_DIR];

  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const testFile = path.join(dir, ".write-test");
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);
      resolvedDbDir = dir;
      return dir;
    } catch {
      continue;
    }
  }

  resolvedDbDir = NORMAL_DB_DIR;
  return resolvedDbDir;
}

export function getMediaDir(): string {
  return path.join(getDbDir(), "media");
}

export function getItemDir(item: MediaItem): string {
  const safeCategory = (item.category || "sans-categorie").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeTitle = (item.title || item.id).replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(getMediaDir(), safeCategory, `${safeTitle}_${item.id}`);
}

export function readItems(): MediaItem[] {
  const mediaDir = getMediaDir();
  if (!fs.existsSync(mediaDir)) {
    return [];
  }

  const items: MediaItem[] = [];
  const categories = fs.readdirSync(mediaDir, { withFileTypes: true });

  for (const category of categories) {
    if (!category.isDirectory()) continue;
    const categoryPath = path.join(mediaDir, category.name);
    const itemFolders = fs.readdirSync(categoryPath, { withFileTypes: true });

    for (const itemFolder of itemFolders) {
      if (!itemFolder.isDirectory()) continue;
      const metadataPath = path.join(categoryPath, itemFolder.name, "metadata.json");
      if (!fs.existsSync(metadataPath)) continue;

      try {
        const raw = fs.readFileSync(metadataPath, "utf-8");
        const item = JSON.parse(raw) as MediaItem;
        items.push(item);
      } catch {
        console.warn(`[ServerStore] Failed to read metadata: ${metadataPath}`);
      }
    }
  }

  console.log(`[ServerStore] readItems() - loaded ${items.length} items from ${mediaDir}`);
  return items;
}

function writeItem(item: MediaItem, options?: { preserveData?: boolean }): void {
  const itemDir = getItemDir(item);
  const metadataPath = path.join(itemDir, "metadata.json");
  const dataPath = path.join(itemDir, "data");

  if (!fs.existsSync(itemDir)) {
    fs.mkdirSync(itemDir, { recursive: true });
  }

  const { dataUrl, ...metadata } = item as MediaItem & { dataUrl?: string };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");

  if (dataUrl) {
    const base64Data = dataUrl.replace(/^data:[^;]+;base64,/, "");
    fs.writeFileSync(dataPath, Buffer.from(base64Data, "base64"));
  } else if (!options?.preserveData && fs.existsSync(dataPath)) {
    fs.unlinkSync(dataPath);
  }
}

function deleteItemDir(item: MediaItem): void {
  const itemDir = getItemDir(item);
  if (fs.existsSync(itemDir)) {
    fs.rmSync(itemDir, { recursive: true, force: true });
  }
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
  syncStatus?: "pending" | "synced";
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
  if (!query.trim()) {
    return items;
  }
  const q = query.toLowerCase().trim();
  const filtered = items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.tags.some((tag) => tag.toLowerCase().includes(q))
  );
  return filtered;
}

export function generateId(): string {
  return `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function getAll(): Promise<MediaItem[]> {
  console.log(`[ServerStore] getAll()`);
  await delay(50);
  return readItems();
}

export async function getAllPaginated(params?: { limit?: number; offset?: number; sortBy?: string; sortOrder?: string; q?: string; category?: string }): Promise<{ items: MediaItem[]; total: number }> {
  console.log(`[ServerStore] getAllPaginated()`, params);
  await delay(50);
  let items = readItems();

  if (params?.category && params.category !== "Tous") {
    const beforeCount = items.length;
    items = items.filter((item) => item.category === params.category);
    console.log(`[ServerStore] getAllPaginated() - category filter "${params.category}": ${items.length}/${beforeCount} items`);
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
  console.log(`[ServerStore] getById() - id=${id}`);
  await delay(30);
  const items = readItems();
  const item = items.find((item) => item.id === id);
  console.log(`[ServerStore] getById() - found=${!!item} title=${item?.title || "null"}`);
  return item;
}

export async function create(item: Omit<MediaItem, "id" | "createdAt" | "updatedAt">): Promise<MediaItem> {
  console.log(`[ServerStore] create() - title="${item.title}" category="${item.category}" kind=${item.kind}`);
  const validationError = validateMediaItem(item);
  if (validationError) {
    console.log(`[ServerStore] create() - VALIDATION ERROR: ${validationError}`);
    throw new Error(validationError);
  }
  await delay(50);
  const now = new Date().toISOString();
  const newItem: MediaItem = {
    ...item,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
  };
  writeItem(newItem);
  console.log(`[ServerStore] create() - created id=${newItem.id} in ${getItemDir(newItem)}`);
  return newItem;
}

export async function update(
  id: string,
  updates: Partial<Omit<MediaItem, "id" | "createdAt">>
): Promise<MediaItem | undefined> {
  console.log(`[ServerStore] update() - id=${id} fields=${Object.keys(updates).join(",")}`);
  await delay(50);
  const items = readItems();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) {
    console.log(`[ServerStore] update() - item not found id=${id}`);
    return undefined;
  }

  const updatedItem: MediaItem = {
    ...items[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const oldItem = items[index];
  const oldDir = getItemDir(oldItem);
  const newDir = getItemDir(updatedItem);
  const oldDataPath = path.join(oldDir, "data");

  if (!updates.dataUrl && fs.existsSync(oldDataPath)) {
    if (oldDir !== newDir) {
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
      }
      fs.copyFileSync(oldDataPath, path.join(newDir, "data"));
    }
  }

  if (updates.category || updates.title) {
    if (oldItem.category !== updatedItem.category || oldItem.title !== updatedItem.title) {
      deleteItemDir(oldItem);
    }
  }

  writeItem(updatedItem, { preserveData: !updates.dataUrl });
  console.log(`[ServerStore] update() - updated id=${id}`);
  return updatedItem;
}

export async function remove(id: string): Promise<boolean> {
  console.log(`[ServerStore] remove() - id=${id}`);
  await delay(50);
  const items = readItems();
  const item = items.find((item) => item.id === id);
  if (!item) {
    console.log(`[ServerStore] remove() - item not found id=${id}`);
    return false;
  }
  deleteItemDir(item);
  console.log(`[ServerStore] remove() - deleted id=${id}`);
  return true;
}

export async function bulkDelete(ids: string[]): Promise<boolean> {
  console.log(`[ServerStore] bulkDelete() - ids=[${ids.join(",")}]`);
  await delay(50);
  if (!ids.length) return false;
  const items = readItems();
  const beforeCount = items.length;
  for (const id of ids) {
    const item = items.find((i) => i.id === id);
    if (item) {
      deleteItemDir(item);
    }
  }
  const deletedCount = beforeCount - items.filter((item) => !ids.includes(item.id)).length;
  console.log(`[ServerStore] bulkDelete() - deleted ${deletedCount} items`);
  return true;
}

export async function bulkTag(ids: string[], tagsToAdd: string[]): Promise<boolean> {
  console.log(`[ServerStore] bulkTag() - ids=[${ids.length} items] tags=[${tagsToAdd.join(",")}]`);
  await delay(50);
  if (!ids.length || !tagsToAdd.length) return false;
  const items = readItems();
  let changed = false;
  let affectedCount = 0;
  items.forEach((item) => {
    if (ids.includes(item.id)) {
      const newTags = Array.from(new Set([...item.tags, ...tagsToAdd]));
      if (newTags.length !== item.tags.length) {
        item.tags = newTags;
        changed = true;
        affectedCount++;
        writeItem(item, { preserveData: true });
      }
    }
  });
  if (!changed) {
    console.log(`[ServerStore] bulkTag() - no changes needed`);
    return false;
  }
  console.log(`[ServerStore] bulkTag() - tagged ${affectedCount} items`);
  return true;
}

export async function markSynced(ids: string[]): Promise<boolean> {
  if (!ids.length) return false;
  const items = readItems();
  let changed = false;
  items.forEach((item) => {
    if (ids.includes(item.id) && item.syncStatus !== "synced") {
      item.syncStatus = "synced";
      writeItem(item, { preserveData: true });
      changed = true;
    }
  });
  return changed;
}

export async function getCategories(): Promise<string[]> {
  console.log(`[ServerStore] getCategories()`);
  await delay(30);
  const items = readItems();
  const cats = new Set<string>();
  items.forEach((item) => cats.add(item.category));
  const categories = ["Tous", ...Array.from(cats).sort()];
  console.log(`[ServerStore] getCategories() - categories=[${categories.join(", ")}]`);
  return categories;
}

function delay(ms = 30): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

