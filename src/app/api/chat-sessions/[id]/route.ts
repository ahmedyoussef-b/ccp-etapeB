import { NextResponse } from "next/server";
import * as store from "@/lib/chat/server-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await store.getSession(params.id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ session });
  } catch (error) {
    console.error("[API] Failed to load session:", error);
    return NextResponse.json({ error: "Failed to load session" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();

    if (Array.isArray(body.messages)) {
      const session = await store.updateSessionMessages(params.id, body.messages);
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      return NextResponse.json({ session });
    }

    if (typeof body.title === "string") {
      const session = await store.updateSessionTitle(params.id, body.title);
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      return NextResponse.json({ session });
    }

    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  } catch (error) {
    console.error("[API] Failed to update session:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const ok = await store.deleteSession(params.id);
    if (!ok) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Failed to delete session:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
