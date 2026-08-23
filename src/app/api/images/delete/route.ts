import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { remove } from "@/lib/images/server-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, type, path: nodePath } = body as {
      id: string;
      type?: string;
      path?: string;
    };

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (type === "image" || (!type && !id.startsWith("image-dir-") && !id.startsWith("image-file-"))) {
      const success = await remove(id);
      if (!success) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    if (!nodePath) {
      return NextResponse.json({ error: "path is required for file/directory deletion" }, { status: 400 });
    }

    const resolvedPath = path.resolve(nodePath);

    if (type === "directory" || (!type && id.startsWith("image-dir-"))) {
      if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
        return NextResponse.json({ error: "Directory not found" }, { status: 404 });
      }
      fs.rmSync(resolvedPath, { recursive: true, force: true });
      return NextResponse.json({ success: true });
    }

    if (type === "file" || (!type && id.startsWith("image-file-"))) {
      if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      fs.unlinkSync(resolvedPath);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unsupported node type" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete node";
    console.error("[API][POST /api/images/delete] - ERROR:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
