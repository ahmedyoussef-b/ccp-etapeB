import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getMediaDir } from "@/lib/images/server-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filePath = url.searchParams.get("path");
    if (!filePath) {
      return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
    }

    const mediaDir = getMediaDir();
    const resolvedPath = path.resolve(filePath);

    if (!resolvedPath.startsWith(mediaDir)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const content = fs.readFileSync(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    const mimeTypeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".bmp": "image/bmp",
      ".svg": "image/svg+xml",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".ogg": "video/ogg",
      ".mov": "video/quicktime",
      ".json": "application/json",
    };

    const mimeType = mimeTypeMap[ext] || "application/octet-stream";

    if (mimeType.startsWith("text/") || mimeType === "application/json") {
      return NextResponse.json({
        content: content.toString("utf-8"),
        mimeType,
        size: content.length,
      });
    }

    const base64 = content.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;
    return NextResponse.json({
      dataUrl,
      mimeType,
      size: content.length,
    });
  } catch (error) {
    console.error("[API][GET /api/images/read-file] - ERROR:", error);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
