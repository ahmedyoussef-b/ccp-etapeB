import { NextResponse } from "next/server";
import * as store from "@/lib/chat/server-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const sessions = await store.getRecentSessions(20);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[API] Failed to load sessions:", error);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title : undefined;
    const session = await store.createSession(title);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error("[API] Failed to create session:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
