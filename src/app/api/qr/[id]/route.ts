import { NextResponse } from "next/server";
import * as store from "@/lib/qr/server-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const pair = await store.getPairById(id);
    if (!pair) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(pair);
  } catch (error) {
    console.error("Failed to fetch Q/R pair:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = await request.json();
    const pair = await store.updatePair(id, body);
    if (!pair) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(pair);
  } catch (error) {
    console.error("Failed to update Q/R pair:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const deleted = await store.deletePair(id);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete Q/R pair:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
