import { NextResponse } from "next/server";
import { getAllPaginated, create, getCategories, bulkDelete, bulkTag } from "@/lib/images/server-store";

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

    console.log(`[API][GET /api/images] - params: limit=${limit} offset=${offset} sortBy=${sortBy} sortOrder=${sortOrder} q="${q}" category="${category}"`);

    const { items, total } = await getAllPaginated({
      limit,
      offset,
      sortBy,
      sortOrder,
      q,
      category,
    });

    const cats = await getCategories();
    console.log(`[API][GET /api/images] - returning ${items.length}/${total} items, ${cats.length} categories`);
    return NextResponse.json({ items, categories: cats, total, limit, offset });
  } catch (error) {
    console.log(`[API][GET /api/images] - ERROR: ${(error as Error).message}`);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
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
    console.log(`[API][DELETE /api/images] - bulk delete ids=[${ids?.join(",")}]`);
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }
    const success = await bulkDelete(ids);
    if (!success) {
      console.log(`[API][DELETE /api/images] - bulk delete failed`);
      return NextResponse.json({ error: "Bulk delete failed" }, { status: 400 });
    }
    console.log(`[API][DELETE /api/images] - deleted ${ids.length} items`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.log(`[API][DELETE /api/images] - ERROR: ${(error as Error).message}`);
    return NextResponse.json({ error: "Bulk delete failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  console.log(`[API][PATCH /api/images] - incoming request`);
  try {
    const body = await request.json();
    const { ids, tags } = body;
    console.log(`[API][PATCH /api/images] - bulk tag ids=[${ids?.length} items] tags=[${tags?.join(",")}]`);
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json({ error: "tags array required" }, { status: 400 });
    }
    const success = await bulkTag(ids, tags);
    if (!success) {
      console.log(`[API][PATCH /api/images] - bulk tag failed`);
      return NextResponse.json({ error: "Bulk tag failed" }, { status: 400 });
    }
    console.log(`[API][PATCH /api/images] - tagged ${ids.length} items`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.log(`[API][PATCH /api/images] - ERROR: ${(error as Error).message}`);
    return NextResponse.json({ error: "Bulk tag failed" }, { status: 500 });
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
