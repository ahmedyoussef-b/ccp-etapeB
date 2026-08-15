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
      nodeMap.set(node.id, {
        ...node,
        children: [],
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString(),
      });
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
    const message = error instanceof Error ? error.message : "Unknown error";
    const isDbUnavailable =
      message.toLowerCase().includes("can't reach database server") ||
      message.toLowerCase().includes("connection") ||
      message.toLowerCase().includes("timeout");

    if (isDbUnavailable) {
      return NextResponse.json(
        {
          error: "database_unavailable",
          message: "La base de données web est indisponible pour le moment.",
          details: message,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to load tree", details: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parentId = body.parentId ?? null;

    const maxOrder = await prisma.treeNode.findFirst({
      where: { parentId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const nextOrder = (maxOrder?.order ?? -1) + 1;

    const validTypes = ["root", "directory", "file"];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json({ error: "Invalid node type" }, { status: 400 });
    }

    const node = await prisma.treeNode.create({
      data: {
        name: body.name,
        type: body.type,
        metadata: body.metadata ?? null,
        parentId,
        order: nextOrder,
      },
    });
    return NextResponse.json(node, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid node" }, { status: 400 });
  }
}
