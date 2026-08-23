import { prisma } from "@/lib/prisma";
import {
  create as createDiskItem,
  update as updateDiskItem,
  remove as removeDiskItem,
} from "@/lib/images/server-store";

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

export async function getAllItems(): Promise<MediaItem[]> {
  const items = await prisma.mediaItem.findMany({
    orderBy: { createdAt: "desc" },
  });

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    description: item.description || "",
    tags: item.tags,
    kind: item.kind as "image" | "video",
    mimeType: item.mimeType,
    size: item.size,
    dataUrl: item.dataUrl,
    thumbnailDataUrl: item.thumbnailDataUrl || undefined,
    geolocation: item.geolocation ? JSON.parse(item.geolocation) : undefined,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    syncStatus: "synced" as const,
  }));
}

export async function getItemById(id: string): Promise<MediaItem | undefined> {
  const item = await prisma.mediaItem.findUnique({
    where: { id },
  });

  if (!item) return undefined;

  return {
    id: item.id,
    title: item.title,
    category: item.category,
    description: item.description || "",
    tags: item.tags,
    kind: item.kind as "image" | "video",
    mimeType: item.mimeType,
    size: item.size,
    dataUrl: item.dataUrl,
    thumbnailDataUrl: item.thumbnailDataUrl || undefined,
    geolocation: item.geolocation ? JSON.parse(item.geolocation) : undefined,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    syncStatus: "synced" as const,
  };
}

export async function createItem(item: Omit<MediaItem, "id" | "createdAt" | "updatedAt">): Promise<MediaItem> {
  const created = await prisma.mediaItem.create({
    data: {
      title: item.title,
      category: item.category,
      description: item.description,
      tags: item.tags,
      kind: item.kind,
      mimeType: item.mimeType,
      size: item.size,
      dataUrl: item.dataUrl,
      thumbnailDataUrl: item.thumbnailDataUrl,
      geolocation: item.geolocation ? JSON.stringify(item.geolocation) : null,
    },
  });

  const mediaItem: MediaItem = {
    id: created.id,
    title: created.title,
    category: created.category,
    description: created.description || "",
    tags: created.tags,
    kind: created.kind as "image" | "video",
    mimeType: created.mimeType,
    size: created.size,
    dataUrl: created.dataUrl,
    thumbnailDataUrl: created.thumbnailDataUrl || undefined,
    geolocation: created.geolocation ? JSON.parse(created.geolocation) : undefined,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
    syncStatus: "synced" as const,
  };

  // Also write to filesystem in .data/registry/<category>/<slug>/
  try {
    await createDiskItem({
      ...item,
      id: created.id,
    } as Parameters<typeof createDiskItem>[0]);
  } catch (err) {
    console.warn("[ServerStorePrisma] Disk mirror warning:", err);
  }

  return mediaItem;
}

export async function updateItem(id: string, updates: Partial<Omit<MediaItem, "id" | "createdAt">>): Promise<MediaItem | undefined> {
  const data: Record<string, unknown> = { ...updates };

  if (updates.geolocation) {
    data.geolocation = JSON.stringify(updates.geolocation);
  }

  const updated = await prisma.mediaItem.update({
    where: { id },
    data,
  });

  const mediaItem: MediaItem = {
    id: updated.id,
    title: updated.title,
    category: updated.category,
    description: updated.description || "",
    tags: updated.tags,
    kind: updated.kind as "image" | "video",
    mimeType: updated.mimeType,
    size: updated.size,
    dataUrl: updated.dataUrl,
    thumbnailDataUrl: updated.thumbnailDataUrl || undefined,
    geolocation: updated.geolocation ? JSON.parse(updated.geolocation) : undefined,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    syncStatus: "synced" as const,
  };

  try {
    await updateDiskItem(id, updates);
  } catch (err) {
    console.warn("[ServerStorePrisma] Disk update warning:", err);
  }

  return mediaItem;
}

export async function deleteItem(id: string): Promise<boolean> {
  try {
    await removeDiskItem(id);
  } catch (err) {
    console.warn("[ServerStorePrisma] Disk delete warning:", err);
  }

  const result = await prisma.mediaItem.delete({
    where: { id },
  });
  return !!result;
}

export async function getCategories(): Promise<string[]> {
  const items = await prisma.mediaItem.findMany({
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });

  return ["Tous", ...items.map((i) => i.category)];
}

export async function searchItems(query: string): Promise<MediaItem[]> {
  const items = await prisma.mediaItem.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    description: item.description || "",
    tags: item.tags,
    kind: item.kind as "image" | "video",
    mimeType: item.mimeType,
    size: item.size,
    dataUrl: item.dataUrl,
    thumbnailDataUrl: item.thumbnailDataUrl || undefined,
    geolocation: item.geolocation ? JSON.parse(item.geolocation) : undefined,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    syncStatus: "synced" as const,
  }));
}
