import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ChatRequestBody {
  message: string;
  history?: Array<{ role: string; content: string }>;
  sessionId?: string;
}

export async function POST(request: Request) {
  try {
    const body: ChatRequestBody = await request.json();

    if (!body.message || typeof body.message !== "string") {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const trimmed = body.message.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    return NextResponse.json({
      error: "RAG is now client-side only. Use the ClientEngine in the browser.",
      response: "L'assistant RAG est maintenant exécuté côté client. Veuillez utiliser l'interface de chat directement.",
      route: "client-only",
      sources: [],
    });
  } catch (error) {
    console.error("[API] RAG chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process RAG chat" },
      { status: 500 }
    );
  }
}
