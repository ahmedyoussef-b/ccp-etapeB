import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await prisma.mediaCategory.findMany({
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("[API][GET /api/media-categories] - ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch media categories" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, parentId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Le nom de la catégorie est requis" }, { status: 400 });
    }

    const maxOrder = await prisma.mediaCategory.findFirst({
      where: { parentId: parentId || null },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const category = await prisma.mediaCategory.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        parentId: parentId || null,
        order: (maxOrder?.order ?? -1) + 1,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("[API][POST /api/media-categories] - ERROR:", error);
    const message = error instanceof Error ? error.message : "Invalid data";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
