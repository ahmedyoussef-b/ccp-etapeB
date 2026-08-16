import { NextResponse } from "next/server";
import { exportPairAsJson } from "@/lib/qr/server-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const filename = await exportPairAsJson(
      { question: body.question, answer: body.answer },
      body.title
    );
    return NextResponse.json({ success: true, filename }, { status: 201 });
  } catch (error) {
    console.error("Failed to export Q/R JSON:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
