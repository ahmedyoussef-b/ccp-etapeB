import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const REGISTRY_DIR = path.join(process.cwd(), ".data", "registry");

interface TreeNode {
  id: string;
  name: string;
  type: "directory" | "file";
  children: TreeNode[];
  path: string;
}

function buildTree(dirPath: string, relativePath = ""): TreeNode[] {
  const nodes: TreeNode[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    const id = `registry-${relPath.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

    if (entry.isDirectory()) {
      nodes.push({
        id,
        name: entry.name,
        type: "directory",
        path: relPath,
        children: buildTree(fullPath, relPath),
      });
    } else {
      nodes.push({
        id,
        name: entry.name,
        type: "file",
        path: relPath,
        children: [],
      });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function GET() {
  try {
    if (!fs.existsSync(REGISTRY_DIR)) {
      return NextResponse.json({ roots: [] });
    }

    const roots = buildTree(REGISTRY_DIR);
    return NextResponse.json({ roots });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[RegistryTree] Failed to load registry tree:", message);
    return NextResponse.json({ error: message, roots: [] }, { status: 500 });
  }
}
