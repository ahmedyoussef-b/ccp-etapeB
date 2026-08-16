import { NextResponse } from "next/server";
import * as store from "@/lib/qr/server-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    if (query) {
      const results = await store.searchPairs(query);
      return NextResponse.json({ results });
    }

    const registries = await store.getRegistries();
    return NextResponse.json({ registries });
  } catch (error) {
    console.error("Failed to search Q/R:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
