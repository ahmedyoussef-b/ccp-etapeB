import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { DOCUMENTS_DIR } from "@/lib/vector/paths";

function resolveVectorPath(relativePath: string): string {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/)?)+/, '');
  const fullPath = path.join(DOCUMENTS_DIR, normalized);
  if (!fullPath.startsWith(DOCUMENTS_DIR)) {
    throw new Error("Invalid path");
  }
  return fullPath;
}

function deleteVectorNode(targetPath: string) {
  if (!targetPath.startsWith(DOCUMENTS_DIR)) {
    throw new Error("Invalid path");
  }

  if (fs.existsSync(targetPath)) {
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true });
    } else {
      fs.unlinkSync(targetPath);
    }
  }
}

function createVectorNode(parentPath: string, name: string, type: "category" | "collection" | "document") {
  const fullParent = resolveVectorPath(parentPath);
  const fullPath = path.join(fullParent, name);

  if (type === "document") {
    fs.writeFileSync(fullPath, JSON.stringify({ chunks: [], metadata: {} }, null, 2));
  } else {
    fs.mkdirSync(fullPath, { recursive: true });
  }

  return fullPath;
}

function renameVectorNode(oldPath: string, newName: string) {
  const fullOldPath = resolveVectorPath(oldPath);
  const newPath = path.join(path.dirname(fullOldPath), newName);

  if (!newPath.startsWith(DOCUMENTS_DIR)) {
    throw new Error("Invalid path");
  }

  fs.renameSync(fullOldPath, newPath);
  return newPath;
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const decodedPath = decodeURIComponent(params.id);
    const targetPath = resolveVectorPath(decodedPath);

    deleteVectorNode(targetPath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete vector node:", error);
    return NextResponse.json({ error: "Failed to delete vector node" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const parentPath = decodeURIComponent(params.id);
    const { name, type = "category" } = await request.json();

    const validTypes = ["category", "collection", "document"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid node type" }, { status: 400 });
    }

    const fullPath = createVectorNode(parentPath, name, type);
    const stat = fs.statSync(fullPath);

    return NextResponse.json({
      success: true,
      path: fullPath,
      node: {
        id: name,
        name,
        type,
        children: [],
        path: fullPath,
        createdAt: stat.birthtime.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to create vector node:", error);
    return NextResponse.json({ error: "Failed to create vector node" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const decodedPath = decodeURIComponent(params.id);
    const { newName } = await request.json();

    const newPath = renameVectorNode(decodedPath, newName);

    return NextResponse.json({ success: true, path: newPath });
  } catch (error) {
    console.error("Failed to rename vector node:", error);
    return NextResponse.json({ error: "Failed to rename vector node" }, { status: 500 });
  }
}
