import { NextResponse } from "next/server";
import { readItems } from "@/lib/images/server-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const category = url.searchParams.get("category") || "";

    let items = readItems();

    if (category && category !== "Tous") {
      items = items.filter((item) => item.category === category);
    }

    if (q.trim()) {
      const query = q.toLowerCase().trim();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          item.category.toLowerCase().includes(query)
      );
    }

    const sorted = items
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);

    return NextResponse.json({
      items: sorted,
      total: sorted.length,
      query: q,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to search images";
    console.error("[API][GET /api/images/search] - ERROR:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
