import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ensureVectorDataDir, DOCUMENTS_DIR } from "@/lib/vector/paths";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface VectorTreeNode {
  id: string;
  name: string;
  type: "root" | "category" | "collection" | "document" | "chunk" | "embedding";
  children: VectorTreeNode[];
  path: string;
  size?: number;
  chunks?: number;
  embeddingModel?: string;
  createdAt?: string;
}

function buildVectorTree(): VectorTreeNode[] {
  ensureVectorDataDir();
  const nodes: VectorTreeNode[] = [];

  try {
    const entries = fs.readdirSync(DOCUMENTS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(DOCUMENTS_DIR, entry.name);
      const relativePath = path.relative(DOCUMENTS_DIR, entryPath);

      if (entry.isDirectory()) {
        const children = buildVectorTreeFromDir(entryPath, relativePath);
        const stat = fs.statSync(entryPath);
        nodes.push({
          id: relativePath,
          name: entry.name,
          type: "category",
          children,
          path: entryPath,
          createdAt: stat.birthtime.toISOString(),
        });
      } else {
        const stat = fs.statSync(entryPath);
        const content = fs.readFileSync(entryPath, "utf-8");
        let chunks = 1;
        try {
          const data = JSON.parse(content);
          if (Array.isArray(data.chunks)) chunks = data.chunks.length;
        } catch {
          // not JSON, count as 1 chunk
        }
        nodes.push({
          id: relativePath,
          name: entry.name,
          type: "document",
          children: [],
          path: entryPath,
          size: stat.size,
          chunks,
          createdAt: stat.birthtime.toISOString(),
        });
      }
    }

    if (nodes.length === 0) {
      nodes.push({
        id: "root",
        name: "BDD Vectorielle",
        type: "root",
        children: [],
        path: DOCUMENTS_DIR,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Failed to build vector tree:", error);
  }

  return nodes;
}

function buildVectorTreeFromDir(dirPath: string, relativePath: string): VectorTreeNode[] {
  const nodes: VectorTreeNode[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const children = buildVectorTreeFromDir(entryPath, entryRelativePath);
        const stat = fs.statSync(entryPath);
        nodes.push({
          id: entryRelativePath,
          name: entry.name,
          type: "collection",
          children,
          path: entryPath,
          createdAt: stat.birthtime.toISOString(),
        });
      } else {
        const stat = fs.statSync(entryPath);
        const content = fs.readFileSync(entryPath, "utf-8");
        let chunks = 1;
        try {
          const data = JSON.parse(content);
          if (Array.isArray(data.chunks)) chunks = data.chunks.length;
        } catch {
          // not JSON
        }
        nodes.push({
          id: entryRelativePath,
          name: entry.name,
          type: "document",
          children: [],
          path: entryPath,
          size: stat.size,
          chunks,
          createdAt: stat.birthtime.toISOString(),
        });
      }
    }
  } catch (error) {
    console.error(`Failed to read vector directory ${dirPath}:`, error);
  }

  return nodes;
}

export async function GET() {
  try {
    ensureVectorDataDir();
    const tree = buildVectorTree();
    return NextResponse.json({ tree });
  } catch (error) {
    console.error("Failed to fetch vector tree:", error);
    return NextResponse.json({ error: "Failed to load vector tree" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    ensureVectorDataDir();
    const body = await request.json();
    const { name, type = "category" } = body;

    const validTypes = ["category", "collection", "document"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid node type" }, { status: 400 });
    }

    const newPath = path.join(DOCUMENTS_DIR, name);
    if (type === "document") {
      fs.writeFileSync(newPath, JSON.stringify({ chunks: [], metadata: {} }, null, 2));
    } else {
      fs.mkdirSync(newPath, { recursive: true });
    }

    const stat = fs.statSync(newPath);
    const newNode: VectorTreeNode = {
      id: name,
      name,
      type: type as VectorTreeNode["type"],
      children: [],
      path: newPath,
      createdAt: stat.birthtime.toISOString(),
    };

    return NextResponse.json(newNode, { status: 201 });
  } catch (error) {
    console.error("Failed to create vector node:", error);
    return NextResponse.json({ error: "Failed to create vector node" }, { status: 500 });
  }
}
