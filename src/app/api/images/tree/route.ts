import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

type ImageNode = {
  id: string;
  name: string;
  type: "directory" | "file";
  path: string;
  children: ImageNode[];
  size?: number;
  createdAt: string;
  updatedAt: string;
};

const MEDIA_DIR = path.join(process.cwd(), ".local-db", "images", "media");

function scanDir(dirPath: string, depth = 0): ImageNode[] {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const nodes: ImageNode[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const stat = fs.statSync(fullPath);

    if (entry.isDirectory()) {
      const children = scanDir(fullPath, depth + 1);
      nodes.push({
        id: `image-dir-${fullPath.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
        name: entry.name,
        type: "directory",
        path: fullPath,
        children,
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
      });
    } else {
      nodes.push({
        id: `image-file-${fullPath.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
        name: entry.name,
        type: "file",
        path: fullPath,
        size: stat.size,
        children: [],
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
      });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!fs.existsSync(MEDIA_DIR)) {
      return NextResponse.json({ roots: [] });
    }

    const roots = scanDir(MEDIA_DIR);
    return NextResponse.json({ roots });
  } catch (error) {
    console.error("Failed to load image tree:", error);
    return NextResponse.json({ error: "Failed to load image tree" }, { status: 500 });
  }
}
