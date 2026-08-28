import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MirrorType = "sqlite" | "indexeddb" | "media" | "generic";

const MIRROR_MAP: Record<MirrorType, string> = {
  sqlite: ".data/mirror-sqlite",
  indexeddb: ".data/mirror-indexeddb",
  media: ".data/mirror-media",
  generic: ".data/mirror-tree",
};

const FILTER_MAP: Record<MirrorType, (node: Record<string, unknown>) => boolean> = {
  sqlite: () => true,
  indexeddb: (node) => !(node.type === "file" && !node.content),
  media: (node) => ["image", "video", "audio", "directory", "root"].includes(node.type as string),
  generic: () => true,
};

function buildTree(nodes: unknown[]): Record<string, unknown>[] {
  const nodeMap = new Map();
  const roots: Record<string, unknown>[] = [];

  const list = Array.isArray(nodes) ? nodes : [];
  for (const node of list) {
    const record = node as Record<string, unknown>;
    nodeMap.set(record.id, { ...record, children: [] as Record<string, unknown>[] });
  }

  for (const node of nodeMap.values()) {
    const record = node as Record<string, unknown>;
    if (record.parentId && nodeMap.has(record.parentId)) {
      const parent = nodeMap.get(record.parentId) as Record<string, unknown>;
      (parent.children as Record<string, unknown>[]).push(record);
    } else {
      roots.push(record);
    }
  }

  return roots;
}

function filterTree(tree: unknown[], filter: (node: Record<string, unknown>) => boolean): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];

  const list = Array.isArray(tree) ? tree : [];
  for (const node of list) {
    const record = node as Record<string, unknown>;
    if (filter(record)) {
      const filteredNode = { ...record };
      if (record.children && Array.isArray(record.children) && record.children.length > 0) {
        filteredNode.children = filterTree(record.children, filter);
      }
      result.push(filteredNode);
    }
  }

  return result;
}

async function generateMirror(basePath: string, tree: unknown[]): Promise<void> {
  await fs.mkdir(basePath, { recursive: true });

  const list = Array.isArray(tree) ? tree : [];
  for (const node of list) {
    const record = node as Record<string, unknown>;
    const nodePath = path.join(basePath, (record.path || record.name || "unnamed") as string);

    if (record.type === "directory" || record.type === "root") {
      await fs.mkdir(nodePath, { recursive: true });

      if (record.metadata) {
        await fs.writeFile(path.join(nodePath, ".meta.json"), JSON.stringify(record.metadata, null, 2));
      }
    } else if (record.type === "file") {
      await fs.mkdir(path.dirname(nodePath), { recursive: true });

      if (record.content) {
        await fs.writeFile(nodePath, record.content as string);
      } else {
        await fs.writeFile(nodePath, "");
      }
    }

    if (record.children && Array.isArray(record.children) && record.children.length > 0) {
      await generateMirror(basePath, record.children);
    }
  }
}

async function countElements(dirPath: string): Promise<{ directories: number; files: number }> {
  let directories = 0;
  let files = 0;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        directories++;
        const subStats = await countElements(path.join(dirPath, entry.name));
        directories += subStats.directories;
        files += subStats.files;
      } else {
        files++;
      }
    }
  } catch (error) {
    console.error("[Mirror] Count error:", error);
  }

  return { directories, files };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: MirrorType }> }
) {
  try {
    const resolvedParams = await params;
    const type: MirrorType = resolvedParams.type || "generic";
    const mirrorPath = MIRROR_MAP[type] || MIRROR_MAP.generic;
    const filter = FILTER_MAP[type] || FILTER_MAP.generic;

    const nodes = await prisma.treeNode.findMany({
      orderBy: { order: "asc" },
    });

    const tree = buildTree(nodes as unknown[]);
    const filteredTree = filterTree(tree, filter);

    const fullPath = path.join(process.cwd(), mirrorPath);
    await fs.rm(fullPath, { recursive: true, force: true });
    await fs.mkdir(fullPath, { recursive: true });

    await generateMirror(fullPath, filteredTree);

    const stats = await countElements(fullPath);

    return NextResponse.json({
      success: true,
      type,
      path: mirrorPath,
      absolutePath: fullPath,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Mirror API] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
