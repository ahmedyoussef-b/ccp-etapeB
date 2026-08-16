import { NextResponse } from "next/server";
import { importRegistryFiles } from "@/lib/qr/server-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await importRegistryFiles();
    return NextResponse.json({
      success: true,
      message: "Import depuis .data/registry/items/ terminé",
      ...result,
    });
  } catch (error) {
    console.error("Failed to import registry files:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
