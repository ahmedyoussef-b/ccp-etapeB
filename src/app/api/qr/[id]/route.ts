import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const pair = await prisma.qAPair.findUnique({
      where: { id },
      include: { registry: true },
    });
    if (!pair) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(toPairWithRegistry(pair));
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
    const data: Record<string, unknown> = {};
    if (typeof body.question === "string" && body.question.trim()) {
      data.question = body.question.trim();
    }
    if (typeof body.answer === "string" && body.answer.trim()) {
      data.answer = body.answer.trim();
    }
    if (typeof body.registryId === "number") {
      data.registryId = body.registryId;
    }
    if (typeof body.order === "number") {
      data.order = body.order;
    }

    const pair = await prisma.qAPair.update({
      where: { id },
      data,
      include: { registry: true },
    });
    return NextResponse.json(toPairWithRegistry(pair));
  } catch (error) {
    console.error("Failed to update Q/R pair:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    await prisma.qAPair.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete Q/R pair:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
