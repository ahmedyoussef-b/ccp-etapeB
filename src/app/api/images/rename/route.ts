import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, path: nodePath, type } = body as {
      id: string;
      name: string;
      path?: string;
      type?: string;
    };

    if (!id || !name || !name.trim()) {
      return NextResponse.json({ error: "id and name are required" }, { status: 400 });
    }

    if (type === "directory" || (!type && id.startsWith("image-dir-"))) {
      const targetPath = nodePath;
      if (!targetPath || !fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) {
        return NextResponse.json({ error: "Directory not found" }, { status: 404 });
      }
      const newPath = path.join(path.dirname(targetPath), name.trim());
      if (fs.existsSync(newPath)) {
        return NextResponse.json({ error: "Target directory already exists" }, { status: 409 });
      }
      fs.renameSync(targetPath, newPath);
      return NextResponse.json({ success: true, newPath });
    }

    if (type === "file" || (!type && id.startsWith("image-file-"))) {
      const targetPath = nodePath;
      if (!targetPath || !fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      const newPath = path.join(path.dirname(targetPath), name.trim());
      if (fs.existsSync(newPath)) {
        return NextResponse.json({ error: "Target file already exists" }, { status: 409 });
      }
      fs.renameSync(targetPath, newPath);
      return NextResponse.json({ success: true, newPath });
    }

    if (type === "image" || (!type && !id.startsWith("image-dir-") && !id.startsWith("image-file-"))) {
      const { update } = await import("@/lib/images/server-store");
      const item = await update(id, { title: name.trim() });
      if (!item) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, item });
    }

    return NextResponse.json({ error: "Unsupported node type" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to rename node";
    console.error("[API][POST /api/images/rename] - ERROR:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
