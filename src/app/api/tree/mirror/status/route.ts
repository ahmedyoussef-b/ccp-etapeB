import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  const mirrors = ["mirror-sqlite", "mirror-indexeddb", "mirror-media"];
  const result: Record<string, { exists: boolean; count: number }> = {};

  for (const mirror of mirrors) {
    const mirrorPath = path.join(process.cwd(), ".data", mirror);
    try {
      const stats = await fs.stat(mirrorPath);
      if (stats.isDirectory()) {
        const entries = await fs.readdir(mirrorPath);
        result[mirror] = { exists: true, count: entries.length };
      } else {
        result[mirror] = { exists: false, count: 0 };
      }
    } catch {
      result[mirror] = { exists: false, count: 0 };
    }
  }

  return NextResponse.json(result);
}
