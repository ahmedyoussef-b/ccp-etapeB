import { NextResponse } from "next/server";
import * as store from "@/lib/qr/server-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const pairs = await store.getAllPairs();
    return NextResponse.json({ pairs });
  } catch (error) {
    console.error("Failed to fetch Q/R pairs:", error);
    return NextResponse.json({ error: "Failed to load Q/R pairs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("[Q/R POST] body:", { q: body.question?.slice(0, 30), a: body.answer?.slice(0, 30) });
    const pair = await store.createPair(body);
    console.log("[Q/R POST] created:", pair.id);
    return NextResponse.json(pair, { status: 201 });
  } catch (error) {
    console.error("[Q/R POST] error:", error);
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
}
