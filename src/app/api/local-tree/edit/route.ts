import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), ".data");

function resolveLocalPath(relativePath: string): string {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/)?)+/, '');
  const fullPath = path.join(DATA_DIR, normalized);
  if (!fullPath.startsWith(DATA_DIR)) {
    throw new Error("Invalid path");
  }
  return fullPath;
}

export async function PUT(
  request: Request,
  { params }: { params: { path: string } }
) {
  try {
    const decodedPath = decodeURIComponent(params.path);
    const fullPath = resolveLocalPath(decodedPath);

    const { content } = await request.json();
    fs.writeFileSync(fullPath, content);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to edit file:", error);
    return NextResponse.json({ error: "Failed to edit file" }, { status: 500 });
  }
}
