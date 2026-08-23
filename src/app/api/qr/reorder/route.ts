import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { pairs } = body as { pairs: { id: number; order: number }[] };

    if (!Array.isArray(pairs)) {
      return NextResponse.json({ error: "pairs array is required" }, { status: 400 });
    }

    await prisma.$transaction(
      pairs.map((p) =>
        prisma.qAPair.update({
          where: { id: p.id },
          data: { order: p.order },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Q/R PATCH reorder] error:", msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
