import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIRROR_ROOT = path.join(process.cwd(), ".data", "mirror-tree");

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeName(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, "_").trim() || "unnamed";
}

function createMirrorNodes(nodes: unknown[], baseDir: string) {
  ensureDir(baseDir);

  const list = Array.isArray(nodes) ? nodes : [];
  for (const node of list) {
    const record = node as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : "unnamed";
    const safeName = sanitizeName(name);
    const nodeDir = path.join(baseDir, safeName);
    ensureDir(nodeDir);

    const children = record.children;
    if (Array.isArray(children)) {
      createMirrorNodes(children, nodeDir);
    }
  }
}

export async function POST() {
  try {
    const { prisma } = await import("@/lib/prisma");
    const dbNodes = await prisma.treeNode.findMany({
      orderBy: { order: "asc" },
    });

    const nodeMap = new Map<number | string, Record<string, unknown>>();
    const roots: Record<string, unknown>[] = [];

    for (const node of dbNodes) {
      nodeMap.set(node.id, { ...node, children: [] as Record<string, unknown>[] });
    }

    for (const node of dbNodes) {
      const item = nodeMap.get(node.id);
      if (!item) continue;
      if (node.parentId && nodeMap.has(node.parentId)) {
        const parent = nodeMap.get(node.parentId)!;
        (parent.children as Record<string, unknown>[]).push(item);
      } else {
        roots.push(item);
      }
    }

    if (fs.existsSync(MIRROR_ROOT)) {
      fs.rmSync(MIRROR_ROOT, { recursive: true, force: true });
    }
    ensureDir(MIRROR_ROOT);

    createMirrorNodes(roots, MIRROR_ROOT);

    const entries = fs.readdirSync(MIRROR_ROOT, { recursive: true }) as string[];
    const totalDirs = entries.filter((entry) => {
      const fullPath = path.join(MIRROR_ROOT, entry);
      return fs.statSync(fullPath).isDirectory();
    }).length;

    return NextResponse.json({
      success: true,
      path: MIRROR_ROOT,
      message: `Miroir généré: ${totalDirs} dossiers`,
    });
  } catch (error) {
    console.error("[TreeMirror] Failed:", error);
    return NextResponse.json(
      { error: "Failed to generate mirror", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
