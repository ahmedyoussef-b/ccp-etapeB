import fs from "fs";
import path from "path";

// ─── MIME extensions ──────────────────────────────────────────────────────────

const MIME_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogg",
  "video/quicktime": "mov",
};

function getMimeTypeExtension(mimeType: string): string {
  return MIME_TYPE_EXTENSIONS[mimeType] || "bin";
}

// ─── Slug helper ──────────────────────────────────────────────────────────────

/**
 * Produce a safe filesystem slug from a media title.
 * "ahmed abbes" → "ahmed_abbes"
 * "Équipement lourd" → "equipement_lourd"
 */
export function titleSlug(item: Pick<MediaItem, "title" | "id">): string {
  return (item.title || item.id)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ─── Base directory ───────────────────────────────────────────────────────────

/**
 * Root of the media registry on disk.
 * On Vercel (read-only filesystem) we fall back to /tmp.
 * Locally we write into the project's .data/registry directory so the
 * Structure BDD tree can see the files.
 */
export function getMediaDir(): string {
  const dataDir = path.join(process.cwd(), ".data", "registry");
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const testFile = path.join(dataDir, ".write-test");
    fs.writeFileSync(testFile, "ok");
    fs.unlinkSync(testFile);
    return dataDir;
  } catch {
    // Vercel / read-only fs fallback
    const tmpDir = path.join("/tmp", ".data", "registry");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    return tmpDir;
  }
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Directory for a single media item:
 *   .data/registry/<category>/<title_slug>/
 *
 * e.g. category = "ressources humaines/equipe B", title = "ahmed abbes"
 *   → .data/registry/ressources humaines/equipe B/ahmed_abbes/
 */
export function getItemDir(item: Pick<MediaItem, "title" | "id" | "category">): string {
  let category = (item.category || "sans-categorie").trim();
  if (category.startsWith("registry/")) {
    category = category.slice("registry/".length);
  } else if (category === "registry") {
    category = "";
  }
  const segments = category ? category.split("/").filter(Boolean) : [];
  const slug = titleSlug(item as Pick<MediaItem, "title" | "id">);
  return path.join(getMediaDir(), ...segments, slug);
}

/** Path to the binary media file: <itemDir>/<title_slug>.<ext> */
function getMediaFilePath(item: Pick<MediaItem, "title" | "id" | "category" | "mimeType">): string {
  const ext = getMimeTypeExtension(item.mimeType);
  return path.join(getItemDir(item), `${titleSlug(item as Pick<MediaItem, "title" | "id">)}.${ext}`);
}

/** Path to the JSON metadata file: <itemDir>/<title_slug>.json */
export function getItemMetadataPath(item: Pick<MediaItem, "title" | "id" | "category">): string {
  return path.join(getItemDir(item), `${titleSlug(item as Pick<MediaItem, "title" | "id">)}.json`);
}

// ─── resolveDataUrl ───────────────────────────────────────────────────────────

export function resolveDataUrl(item: MediaItem): string {
  // New naming: <slug>.<ext>
  const mediaPath = getMediaFilePath(item);
  if (fs.existsSync(mediaPath)) {
    const buffer = fs.readFileSync(mediaPath);
    return `data:${item.mimeType};base64,${buffer.toString("base64")}`;
  }
  // Legacy fallback: media.<ext>
  const ext = getMimeTypeExtension(item.mimeType);
  const legacyMedia = path.join(getItemDir(item), `media.${ext}`);
  if (fs.existsSync(legacyMedia)) {
    const buffer = fs.readFileSync(legacyMedia);
    return `data:${item.mimeType};base64,${buffer.toString("base64")}`;
  }
  // Older fallback: raw "data" file
  const legacyData = path.join(getItemDir(item), "data");
  if (fs.existsSync(legacyData)) {
    const buffer = fs.readFileSync(legacyData);
    return `data:${item.mimeType};base64,${buffer.toString("base64")}`;
  }
  return "";
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Validation ───────────────────────────────────────────────────────────────

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

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Recursively scan the registry directory for *.json files that look like
 * media metadata (i.e. they have an "id" field).  This replaces the old
 * flat "metadata.json" approach.
 */
export function readItems(): MediaItem[] {
  const mediaDir = getMediaDir();
  if (!fs.existsSync(mediaDir)) return [];

  const items: MediaItem[] = [];

  function scanDir(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".json") &&
        !entry.name.startsWith(".")
      ) {
        try {
          const raw = fs.readFileSync(fullPath, "utf-8");
          const parsed = JSON.parse(raw) as Partial<MediaItem>;
          // Only treat as a media item if it has the required fields
          if (parsed.id && parsed.title && parsed.mimeType) {
            items.push(parsed as MediaItem);
          }
        } catch {
          console.warn(`[ServerStore] Failed to parse JSON: ${fullPath}`);
        }
      }
    }
  }

  scanDir(mediaDir);
  console.log(`[ServerStore] readItems() - loaded ${items.length} items from ${mediaDir}`);
  return items;
}

// ─── Write ────────────────────────────────────────────────────────────────────

function writeItem(item: MediaItem, options?: { preserveData?: boolean }): void {
  const itemDir = getItemDir(item);
  const metadataPath = getItemMetadataPath(item);
  const mediaFilePath = getMediaFilePath(item);

  if (!fs.existsSync(itemDir)) {
    fs.mkdirSync(itemDir, { recursive: true });
  }

  // Strip the raw dataUrl from the persisted JSON to keep it small
  const { dataUrl, ...metadata } = item as MediaItem & { dataUrl?: string };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");

  if (dataUrl) {
    const base64Data = dataUrl.replace(/^data:[^;]+;base64,/, "");
    fs.writeFileSync(mediaFilePath, Buffer.from(base64Data, "base64"));
  } else if (!options?.preserveData) {
    if (fs.existsSync(mediaFilePath)) fs.unlinkSync(mediaFilePath);
  }
}

function deleteItemDir(item: Pick<MediaItem, "title" | "id" | "category">): void {
  const itemDir = getItemDir(item);
  if (fs.existsSync(itemDir)) {
    fs.rmSync(itemDir, { recursive: true, force: true });
  }
}

// ─── Sort / search helpers ────────────────────────────────────────────────────

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
      item.description?.toLowerCase().includes(q) ||
      item.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

// ─── ID generator ─────────────────────────────────────────────────────────────

export function generateId(): string {
  return `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getAll(): Promise<MediaItem[]> {
  console.log(`[ServerStore] getAll()`);
  await delay(50);
  return readItems();
}

export async function getAllPaginated(params?: {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: string;
  q?: string;
  category?: string;
}): Promise<{ items: MediaItem[]; total: number }> {
  console.log(`[ServerStore] getAllPaginated()`, params);
  await delay(50);
  let items = readItems();

  if (params?.category && params.category !== "Tous") {
    const beforeCount = items.length;
    items = items.filter((item) => item.category === params.category);
    console.log(
      `[ServerStore] getAllPaginated() - category filter "${params.category}": ${items.length}/${beforeCount} items`
    );
  }

  if (params?.q?.trim()) items = searchItems(items, params.q);

  const total = items.length;
  const sortOrder = (params?.sortOrder === "asc" ? "asc" : "desc") as "asc" | "desc";
  items = sortItems(items, params?.sortBy || "createdAt", sortOrder);

  const limit = params?.limit || items.length;
  const offset = params?.offset || 0;
  return { items: items.slice(offset, offset + limit), total };
}

export async function getById(id: string): Promise<MediaItem | undefined> {
  console.log(`[ServerStore] getById() - id=${id}`);
  await delay(30);
  const item = readItems().find((i) => i.id === id);
  console.log(`[ServerStore] getById() - found=${!!item} title=${item?.title || "null"}`);
  return item;
}

export async function create(
  item: Omit<MediaItem, "id" | "createdAt" | "updatedAt">
): Promise<MediaItem> {
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

  const oldItem = items[index];
  const updatedItem: MediaItem = {
    ...oldItem,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const oldDir = getItemDir(oldItem);
  const newDir = getItemDir(updatedItem);
  const oldMediaPath = getMediaFilePath(oldItem);

  // Copy binary file to new location if directory changes
  if (!updates.dataUrl && fs.existsSync(oldMediaPath) && oldDir !== newDir) {
    if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
    fs.copyFileSync(oldMediaPath, getMediaFilePath(updatedItem));
  }

  // Remove old directory if category or title changed
  if (
    (updates.category !== undefined || updates.title !== undefined) &&
    (oldItem.category !== updatedItem.category || oldItem.title !== updatedItem.title)
  ) {
    deleteItemDir(oldItem);
  }

  writeItem(updatedItem, { preserveData: !updates.dataUrl });
  console.log(`[ServerStore] update() - updated id=${id}`);
  return updatedItem;
}

export async function remove(id: string): Promise<boolean> {
  console.log(`[ServerStore] remove() - id=${id}`);
  await delay(50);
  const item = readItems().find((i) => i.id === id);
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
  for (const id of ids) {
    const item = items.find((i) => i.id === id);
    if (item) deleteItemDir(item);
  }
  return true;
}

export async function bulkTag(ids: string[], tagsToAdd: string[]): Promise<boolean> {
  console.log(`[ServerStore] bulkTag() - ids=[${ids.length} items] tags=[${tagsToAdd.join(",")}]`);
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
        writeItem(item, { preserveData: true });
      }
    }
  });
  if (!changed) {
    console.log(`[ServerStore] bulkTag() - no changes needed`);
    return false;
  }
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
