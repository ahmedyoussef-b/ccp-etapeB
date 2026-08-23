import { NextResponse } from "next/server";
import { searchItems } from "@/lib/images/server-store-prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const category = url.searchParams.get("category") || "";

    let items = await searchItems(q);

    if (category && category !== "Tous") {
      items = items.filter((item) => item.category === category);
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
