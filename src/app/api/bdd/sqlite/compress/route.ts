import { NextResponse } from "next/server";
import { getDb } from "@/lib/client-engine/sqlite";
import { compressAllData } from "@/lib/db/compression";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({ error: "SQLite not initialized" }, { status: 500 });
    }

    const result = await compressAllData(db);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Compression failed:", error);
    return NextResponse.json(
      { error: "Compression failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
