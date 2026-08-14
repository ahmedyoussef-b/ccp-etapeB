import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");

function resolveLocalPath(relativePath: string): string {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/)?)+/, '');
  const fullPath = path.join(DATA_DIR, normalized);
  if (!fullPath.startsWith(DATA_DIR)) {
    throw new Error("Invalid path");
  }
  return fullPath;
}

function deleteLocalNode(targetPath: string) {
  if (!targetPath.startsWith(DATA_DIR)) {
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

function createLocalNode(parentPath: string, name: string, type: "file" | "directory") {
  const fullParent = resolveLocalPath(parentPath);
  const fullPath = path.join(fullParent, name);

  if (type === "directory") {
    fs.mkdirSync(fullPath, { recursive: true });
  } else {
    fs.writeFileSync(fullPath, "");
  }

  return fullPath;
}

function renameLocalNode(oldPath: string, newName: string) {
  const fullOldPath = resolveLocalPath(oldPath);
  const newPath = path.join(path.dirname(fullOldPath), newName);

  if (!newPath.startsWith(DATA_DIR)) {
    throw new Error("Invalid path");
  }

  fs.renameSync(fullOldPath, newPath);
  return newPath;
}

export async function DELETE(
  _request: Request,
  { params }: { params: { path: string } }
) {
  try {
    const decodedPath = decodeURIComponent(params.path);
    const targetPath = resolveLocalPath(decodedPath);

    deleteLocalNode(targetPath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete local node:", error);
    return NextResponse.json({ error: "Failed to delete local node" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { path: string } }
) {
  try {
    const parentPath = decodeURIComponent(params.path);
    const { name, type = "directory" } = await request.json();

    const fullPath = createLocalNode(parentPath, name, type);

    return NextResponse.json({ success: true, path: fullPath });
  } catch (error) {
    console.error("Failed to create local node:", error);
    return NextResponse.json({ error: "Failed to create local node" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { path: string } }
) {
  try {
    const decodedPath = decodeURIComponent(params.path);
    const { newName } = await request.json();

    const newPath = renameLocalNode(decodedPath, newName);

    return NextResponse.json({ success: true, path: newPath });
  } catch (error) {
    console.error("Failed to rename local node:", error);
    return NextResponse.json({ error: "Failed to rename local node" }, { status: 500 });
  }
}
