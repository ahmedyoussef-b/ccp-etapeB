import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface TreeNodeWithChildren {
  id: number;
  name: string;
  type: string;
  metadata: string | null;
  parentId: number | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  children: TreeNodeWithChildren[];
}

async function buildTree(parentId: number | null): Promise<TreeNodeWithChildren[]> {
  const nodes = await prisma.treeNode.findMany({
    where: { parentId },
    orderBy: { order: "asc" },
  });

  const result: TreeNodeWithChildren[] = [];
  for (const node of nodes) {
    const item: TreeNodeWithChildren = {
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

export async function GET() {
  try {
    const roots = await prisma.treeNode.findMany({
      where: { parentId: null },
      orderBy: { order: "asc" },
    });

    const tree: TreeNodeWithChildren[] = [];
    for (const root of roots) {
      const item: TreeNodeWithChildren = {
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

    return NextResponse.json({ tree, lastSyncTimestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Failed to fetch sync data:", error);
    return NextResponse.json({ error: "Failed to load sync data" }, { status: 500 });
  }
}
