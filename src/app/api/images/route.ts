import { NextResponse } from "next/server";
import { getAllPaginated, create, getCategories, bulkDelete, bulkTag } from "@/lib/images/server-store";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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

    const cats = await getCategories();
    return NextResponse.json({ items, categories: cats, total, limit, offset });
  } catch {
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const item = await create(body);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid data";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
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
  } catch {
    return NextResponse.json({ error: "Bulk delete failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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
  } catch {
    return NextResponse.json({ error: "Bulk tag failed" }, { status: 500 });
  }
}
