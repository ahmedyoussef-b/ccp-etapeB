import { NextResponse } from "next/server";
import { vectorReindexService } from "@/lib/sync/vector-reindex.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await vectorReindexService.fullReindex();
    return NextResponse.json({
      documentCount: result.documentCount,
      chunkCount: result.chunkCount,
      duration: result.duration,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Reindex failed:", error);
    return NextResponse.json(
      { error: "Reindex failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
