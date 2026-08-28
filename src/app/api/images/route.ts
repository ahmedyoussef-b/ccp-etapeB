import { NextResponse } from "next/server";
import { getAllItems, createItem, getCategories, getItemById, updateItem, deleteItem } from "@/lib/images/server-store-prisma";
import type { MediaItem } from "@/lib/images/server-store-prisma";

type MediaItemWithoutDataUrl = Omit<MediaItem, 'dataUrl'>;

function withoutDataUrl(item: MediaItem): MediaItemWithoutDataUrl {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { dataUrl, ...rest } = item;
  return rest as MediaItemWithoutDataUrl;
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

    let items = await getAllItems();

    if (category && category !== "Tous") {
      items = items.filter((item) => item.category === category);
    }

    if (q.trim()) {
      const query = q.toLowerCase().trim();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    const total = items.length;
    items = sortItems(items, sortBy, sortOrder as "asc" | "desc");
    const paginated = items.slice(offset, offset + limit);

    const cats = await getCategories();
    const sanitized = paginated.map(withoutDataUrl);
    return NextResponse.json({ items: sanitized, categories: cats, total, limit, offset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch images";
    console.log(`[API][GET /api/images] - ERROR: ${message}`);
    const normalized = message.toLowerCase();
    const isDbUnavailable =
      normalized.includes("can't reach database server") ||
      normalized.includes("connection") ||
      normalized.includes("timeout") ||
      normalized.includes("prisma client initializationerror");
    return NextResponse.json(
      { error: isDbUnavailable ? "database_unavailable" : "Failed to load images", details: message },
      { status: isDbUnavailable ? 503 : 500 }
    );
  }
}

export async function POST(request: Request) {
  console.log(`[API][POST /api/images] - incoming request`);
  try {
    const body = await request.json();
    console.log(`[API][POST /api/images] - body: title="${body.title}" category="${body.category}" kind=${body.kind} size=${formatBytes(body.size)}`);
    const item = await createItem(body);
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
    let success = true;
    for (const id of ids) {
      const result = await deleteItem(id);
      if (!result) success = false;
    }
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
    let changed = false;
    for (const id of ids) {
      const item = await getItemById(id);
      if (item) {
        const newTags = Array.from(new Set([...item.tags, ...tags]));
        if (newTags.length !== item.tags.length) {
          await updateItem(id, { tags: newTags });
          changed = true;
        }
      }
    }
    if (!changed) {
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
    return NextResponse.json({ success: true, synced: ids.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    console.log(`[API][PUT /api/images/sync] - ERROR: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

