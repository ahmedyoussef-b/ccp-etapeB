import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), ".data");
const MIRROR_FILE = path.join(DATA_DIR, "mirror.json");

interface LocalTreeNode {
  id: string;
  name: string;
  type: string;
  children: LocalTreeNode[];
  path: string;
}

async function buildTree(dirPath: string, relativePath: string = ""): Promise<LocalTreeNode[]> {
  const nodes: LocalTreeNode[] = [];

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const children = await buildTree(entryPath, entryRelativePath);
        nodes.push({
          id: entryRelativePath,
          name: entry.name,
          type: "folder",
          children,
          path: entryPath,
        });
      } else if (entry.name === ".meta.json") {
        nodes.push({
          id: entryRelativePath,
          name: ".meta.json",
          type: "meta",
          children: [],
          path: entryPath,
        });
      } else {
        nodes.push({
          id: entryRelativePath,
          name: entry.name,
          type: "file",
          children: [],
          path: entryPath,
        });
      }
    }
  } catch (error) {
    console.error(`Failed to read directory ${dirPath}:`, error);
  }

  return nodes;
}

interface MirrorNode {
  id?: string | number;
  name: string;
  type?: string;
  children?: MirrorNode[];
  path?: string;
}

function toRelativeId(node: MirrorNode): string {
  if (typeof node.id === "string" && node.id.trim() !== "" && !path.isAbsolute(node.id)) {
    return node.id;
  }
  if (typeof node.path === "string" && node.path.trim() !== "" && !path.isAbsolute(node.path)) {
    return node.path;
  }
  if (typeof node.path === "string" && node.path.trim() !== "") {
    return path.relative(DATA_DIR, node.path);
  }
  return String(node.name);
}

function transformMirrorNode(node: MirrorNode): LocalTreeNode {
  return {
    id: toRelativeId(node),
    name: node.name,
    type: node.type || "folder",
    children: (node.children || []).map(transformMirrorNode),
    path: node.path || "",
  };
}

export async function GET() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      return NextResponse.json({ tree: [] });
    }

    if (fs.existsSync(MIRROR_FILE)) {
      const mirrorContent = fs.readFileSync(MIRROR_FILE, "utf-8");
      const mirrorData = JSON.parse(mirrorContent);
      const tree = Array.isArray(mirrorData)
        ? mirrorData.map(transformMirrorNode)
        : transformMirrorNode(mirrorData);
      return NextResponse.json({ tree });
    }

    const tree = await buildTree(DATA_DIR);
    return NextResponse.json({ tree });
  } catch (error) {
    console.error("Failed to build local tree:", error);
    return NextResponse.json({ error: "Failed to load local tree" }, { status: 500 });
  }
}

export async function POST() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      return NextResponse.json({ error: "Data directory not found" }, { status: 404 });
    }

    const tree = await buildTree(DATA_DIR);
    
    // Store in IndexedDB via a simple JSON response
    // The actual IndexedDB storage will be handled client-side
    return NextResponse.json({ 
      success: true, 
      tree,
      message: "Local tree data ready for IndexedDB storage" 
    });
  } catch (error) {
    console.error("Failed to prepare local tree for reset:", error);
    return NextResponse.json({ error: "Failed to prepare local tree" }, { status: 500 });
  }
}
