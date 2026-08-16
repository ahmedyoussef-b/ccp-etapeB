import { NextResponse } from "next/server";
import { exportPairAsJson } from "@/lib/qr/server-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("[Q/R export] received:", { q: body.question?.slice(0, 30), a: body.answer?.slice(0, 30) });
    const filename = await exportPairAsJson(
      { question: body.question, answer: body.answer },
      body.title
    );
    console.log("[Q/R export] written:", filename);
    return NextResponse.json({ success: true, filename }, { status: 201 });
  } catch (error) {
    console.error("[Q/R export] error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
