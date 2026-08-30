import { NextResponse } from "next/server";
import { getDb } from "@/lib/client-engine/sqlite";
import { isCompressionEnabled } from "@/lib/db/compression";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({ nodeCount: 0, compressionEnabled: false, lastSync: null });
    }

    const compressionEnabled = isCompressionEnabled(db);

    return NextResponse.json({
      nodeCount: 0,
      compressionEnabled,
      lastSync: null,
    });
  } catch {
    return NextResponse.json({ nodeCount: 0, compressionEnabled: false, lastSync: null });
  }
}
