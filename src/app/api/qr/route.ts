import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toPairWithRegistry(p: {
  id: number;
  question: string;
  answer: string;
  registryId: number;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  registry: { id: number; title: string; description: string | null } | null;
}): {
  id: number;
  question: string;
  answer: string;
  registryId: number;
  registry: { id: number; title: string; description: string | null };
  order: number;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: p.id,
    question: p.question,
    answer: p.answer,
    registryId: p.registryId,
    registry: {
      id: p.registry?.id ?? 0,
      title: p.registry?.title ?? "unknown",
      description: p.registry?.description ?? null,
    },
    order: p.order ?? 0,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function GET() {
  try {
    const { prisma } = await import("@/lib/prisma");
    const pairs = await prisma.qAPair.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      include: { registry: true },
    });
    return NextResponse.json({ pairs: pairs.map(toPairWithRegistry) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Q/R GET] error:", msg, error);
    const isDb = msg.toLowerCase().includes("can't reach database server") || msg.toLowerCase().includes("connection") || msg.toLowerCase().includes("timeout");
    return NextResponse.json(
      { error: isDb ? "database_unavailable" : msg, details: msg },
      { status: isDb ? 503 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const body = await request.json();
    console.log("[Q/R POST] body:", { q: body.question?.slice(0, 30), a: body.answer?.slice(0, 30) });

    const question = typeof body.question === "string" ? body.question.trim() : "";
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";
    if (!question || !answer) {
      return NextResponse.json({ error: "question and answer are required" }, { status: 400 });
    }

    const title = body.registryTitle || question.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().substring(0, 60) || "Général";

    let registry = await prisma.qARegistry.findFirst({ where: { title } });
    if (!registry) {
      registry = await prisma.qARegistry.create({
        data: { title, description: typeof body.registryDescription === "string" ? body.registryDescription : null },
      });
    }

    const pair = await prisma.qAPair.create({
      data: {
        question,
        answer,
        order: 0,
        registryId: registry.id,
      },
      include: { registry: true },
    });

    console.log("[Q/R POST] created:", pair.id);
    return NextResponse.json(toPairWithRegistry(pair), { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Q/R POST] error:", msg, error);
    const isDb = msg.toLowerCase().includes("can't reach database server") || msg.toLowerCase().includes("connection") || msg.toLowerCase().includes("timeout");
    return NextResponse.json(
      { error: isDb ? "database_unavailable" : msg, details: msg },
      { status: isDb ? 503 : 400 }
    );
  }
}
