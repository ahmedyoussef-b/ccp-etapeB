import { NextResponse } from "next/server";
import { getAllPaginated, create, getCategories, bulkDelete, bulkTag, markSynced } from "@/lib/images/server-store";
import fs from "fs";
import path from "path";
import type { MediaItem } from "@/lib/images/server-store";

const MEDIA_DIR = path.join(process.cwd(), ".local-db", "images", "media");

function resolveDataUrl(item: MediaItem): string {
  if (item.dataUrl) return item.dataUrl;
  const itemDir = path.join(MEDIA_DIR, item.category || "sans-categorie", `${(item.title || item.id).replace(/[^a-zA-Z0-9_-]/g, "_")}_${item.id}`);
  const dataPath = path.join(itemDir, "data");
  if (fs.existsSync(dataPath)) {
    const buffer = fs.readFileSync(dataPath);
    return `data:${item.mimeType};base64,${buffer.toString("base64")}`;
  }
  return "";
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  console.log(`[API][GET /api/images] - incoming request`);
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "24", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";
    const q = url.searchParams.get("q") || "";
    const category = url.searchParams.get("category") || "Tous";

    const { items, total } = await getAllPaginated({
      limit,
      offset,
      sortBy,
      sortOrder,
      q,
      category,
    });

    const itemsWithData = items.map((item) => ({
      ...item,
      dataUrl: resolveDataUrl(item),
    }));

    const cats = await getCategories();
    return NextResponse.json({ items: itemsWithData, categories: cats, total, limit, offset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch images";
    console.log(`[API][GET /api/images] - ERROR: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  console.log(`[API][POST /api/images] - incoming request`);
  try {
    const body = await request.json();
    console.log(`[API][POST /api/images] - body: title="${body.title}" category="${body.category}" kind=${body.kind} size=${formatBytes(body.size)}`);
    const item = await create(body);
    console.log(`[API][POST /api/images] - created id=${item.id}`);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid data";
    console.log(`[API][POST /api/images] - ERROR: ${message}`);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  console.log(`[API][DELETE /api/images] - incoming request`);
  try {
    const body = await request.json();
    const { ids } = body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }
    const success = await bulkDelete(ids);
    if (!success) {
      return NextResponse.json({ error: "Bulk delete failed" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bulk delete failed";
    console.log(`[API][DELETE /api/images] - ERROR: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  console.log(`[API][PATCH /api/images] - incoming request`);
  try {
    const body = await request.json();
    const { ids, tags } = body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json({ error: "tags array required" }, { status: 400 });
    }
    const success = await bulkTag(ids, tags);
    if (!success) {
      return NextResponse.json({ error: "Bulk tag failed" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bulk tag failed";
    console.log(`[API][PATCH /api/images] - ERROR: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  console.log(`[API][PUT /api/images/sync] - incoming request`);
  try {
    const body = await request.json();
    const { ids } = body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }
    const success = await markSynced(ids);
    return NextResponse.json({ success, synced: success ? ids.length : 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    console.log(`[API][PUT /api/images/sync] - ERROR: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

