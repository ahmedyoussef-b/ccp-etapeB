import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface TreeNodeWithChildren {
  id: number | string;
  name: string;
  type: string;
  metadata: string | null;
  parentId: number | string | null;
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

    const nodeMap = new Map<number | string, TreeNodeWithChildren>();
    const roots: TreeNodeWithChildren[] = [];

    for (const node of nodes) {
      nodeMap.set(node.id, {
        id: node.id,
        name: node.name,
        type: node.type,
        metadata: node.metadata,
        parentId: node.parentId,
        order: node.order,
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString(),
        children: [],
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

    const folders = nodes.filter((n) => n.type === "directory" || n.type === "root").length;
    const files = nodes.filter((n) => n.type === "file").length;

    return NextResponse.json({
      roots,
      stats: {
        total: nodes.length,
        folders,
        files,
      },
    });
  } catch (error) {
    console.error("Failed to fetch PostgreSQL tree:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const normalized = message.toLowerCase();
    const isDbUnavailable =
      normalized.includes("can't reach database server") ||
      normalized.includes("connection") ||
      normalized.includes("timeout") ||
      normalized.includes("prisma client initializationerror");

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
      { error: "Failed to load PostgreSQL tree", details: message },
      { status: 500 }
    );
  }
}
