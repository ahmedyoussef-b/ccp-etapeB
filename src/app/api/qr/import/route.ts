import { NextResponse } from "next/server";
import { prisma, generateUUID } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items = body.items as Array<{ question: string; answer: string }> | undefined;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    let imported = 0;
    for (const item of items) {
      if (!item.question || !item.answer) continue;

      const title = item.question.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().substring(0, 60) || "Général";
      let registry = await prisma.qARegistry.findFirst({ where: { title } });
      if (!registry) {
        registry = await prisma.qARegistry.create({ data: { uuid: generateUUID(), title } });
      }

      await prisma.qAPair.create({
        data: {
          uuid: generateUUID(),
          question: item.question.trim(),
          answer: item.answer.trim(),
          order: 0,
          registryId: registry.id,
        },
      });
      imported++;
    }

    return NextResponse.json({ success: true, imported, skipped: items.length - imported });
  } catch (error) {
    console.error("Failed to import registry files:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
