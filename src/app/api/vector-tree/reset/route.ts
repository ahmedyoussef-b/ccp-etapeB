import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

import { DOCUMENTS_DIR, INDEX_FILE, METADATA_FILE } from "@/lib/vector/paths";

export async function POST() {
  try {
    if (!fs.existsSync(DOCUMENTS_DIR)) {
      fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
    }

    fs.writeFileSync(INDEX_FILE, JSON.stringify({ version: "1.0", documents: [], embeddings: [] }, null, 2));
    fs.writeFileSync(METADATA_FILE, JSON.stringify({
      totalDocuments: 0,
      totalChunks: 0,
      lastIndexed: null,
      status: "initialized",
    }, null, 2));

    const entries = fs.readdirSync(DOCUMENTS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(DOCUMENTS_DIR, entry.name);
      if (entry.isDirectory()) {
        fs.rmSync(entryPath, { recursive: true });
      } else {
        fs.unlinkSync(entryPath);
      }
    }

    return NextResponse.json({ success: true, message: "BDD Vectorielle remise à zéro" });
  } catch (error) {
    console.error("Failed to reset vector tree:", error);
    return NextResponse.json({ error: "Failed to reset vector tree" }, { status: 500 });
  }
}
