import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), ".data");
const MIRROR_FILE = path.join(DATA_DIR, "mirror.json");

interface TreeNode {
  id: number;
  name: string;
  type: string;
  metadata: string | null;
  parentId: number | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  children: TreeNode[];
}

async function buildTree(parentId: number | null): Promise<TreeNode[]> {
  const nodes = await prisma.treeNode.findMany({
    where: { parentId },
    orderBy: { order: "asc" },
  });

  const result: TreeNode[] = [];
  for (const node of nodes) {
    const item: TreeNode = {
      id: node.id,
      name: node.name,
      type: node.type,
      metadata: node.metadata,
      parentId: node.parentId,
      order: node.order,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
      children: [],
    };

    if (node.type === "directory" || node.type === "root") {
      item.children = await buildTree(node.id);
    }

    result.push(item);
  }

  return result;
}

export async function POST() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const roots = await prisma.treeNode.findMany({
      where: { parentId: null },
      orderBy: { order: "asc" },
    });

    const tree: TreeNode[] = [];
    for (const root of roots) {
      const item: TreeNode = {
        id: root.id,
        name: root.name,
        type: root.type,
        metadata: root.metadata,
        parentId: root.parentId,
        order: root.order,
        createdAt: root.createdAt.toISOString(),
        updatedAt: root.updatedAt.toISOString(),
        children: [],
      };

      if (root.type === "directory" || root.type === "root") {
        item.children = await buildTree(root.id);
      }

      tree.push(item);
    }

    fs.writeFileSync(MIRROR_FILE, JSON.stringify(tree, null, 2));

    return NextResponse.json({
      success: true,
      message: "Web tree mirrored to local storage",
      nodeCount: tree.length,
    });
  } catch (error) {
    console.error("Failed to sync web tree to local:", error);
    return NextResponse.json({ error: "Failed to sync web tree to local" }, { status: 500 });
  }
}
