import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    if (query) {
      const pairs = await prisma.qAPair.findMany({
        where: {
          OR: [
            { question: { contains: query, mode: "insensitive" } },
            { answer: { contains: query, mode: "insensitive" } },
          ],
        },
        include: { registry: true },
        orderBy: { createdAt: "desc" },
      });

      const results = pairs.map((p) => ({
        question: p.question,
        answer: p.answer,
        score: p.question.toLowerCase().includes(query.toLowerCase()) ? 1 : 0.5,
      }));

      return NextResponse.json({ results });
    }

    const registries = await prisma.qARegistry.findMany({
      orderBy: { title: "asc" },
    });

    return NextResponse.json({
      registries: registries.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to search Q/R:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
