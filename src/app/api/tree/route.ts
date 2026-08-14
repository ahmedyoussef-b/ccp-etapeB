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

export async function GET() {
  try {
    const nodes = await prisma.treeNode.findMany({
      orderBy: { order: "asc" },
    });

    const nodeMap = new Map<number, TreeNodeWithChildren>();
    const roots: TreeNodeWithChildren[] = [];

    for (const node of nodes) {
      nodeMap.set(node.id, { ...node, children: [] });
    }

    for (const node of nodes) {
      const item = nodeMap.get(node.id)!;
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(item);
      } else {
        roots.push(item);
      }
    }

    const apiRoots = roots.find((node) => node.type === "root")?.children ?? roots;

    return NextResponse.json({ roots: apiRoots });
  } catch (error) {
    console.error("Failed to fetch tree:", error);
    return NextResponse.json({ error: "Failed to load tree" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const node = await prisma.treeNode.create({
      data: {
        name: body.name,
        type: body.type,
        metadata: body.metadata ?? null,
        parentId: body.parentId ?? null,
        order: body.order ?? 0,
      },
    });
    return NextResponse.json(node, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid node" }, { status: 400 });
  }
}
