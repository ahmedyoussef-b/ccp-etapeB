import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getMediaDir } from "@/lib/images/server-store";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { dirPath, metadata } = body as { dirPath?: string; metadata?: Record<string, unknown> };

    if (!dirPath || !metadata) {
      return NextResponse.json({ error: "Missing dirPath or metadata" }, { status: 400 });
    }

    const mediaDir = getMediaDir();
    const resolvedDir = path.resolve(dirPath);

    if (!resolvedDir.startsWith(mediaDir)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
      return NextResponse.json({ error: "Directory not found" }, { status: 404 });
    }

    const files = fs.readdirSync(resolvedDir).filter((f) => f.startsWith("metadata-") && f.endsWith(".json"));
    if (files.length === 0) {
      return NextResponse.json({ error: "No metadata file found" }, { status: 404 });
    }

    const metadataPath = path.join(resolvedDir, files[0]);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");

    return NextResponse.json({ success: true, file: files[0] });
  } catch (error) {
    console.error("[API][PUT /api/images/update-metadata] - ERROR:", error);
    return NextResponse.json({ error: "Failed to update metadata" }, { status: 500 });
  }
}
