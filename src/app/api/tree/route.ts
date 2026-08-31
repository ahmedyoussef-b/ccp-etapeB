import { NextResponse } from "next/server";
import { readItems } from "@/lib/images/server-store";
import { generateUUID } from "@/lib/prisma";
import { getCachedReadItems, setCachedReadItems } from "@/lib/cache/media-items-cache";

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
    const { prisma } = await import("@/lib/prisma");
    const nodes = await prisma.treeNode.findMany({
      orderBy: { order: "asc" },
    });

    const nodeMap = new Map<number | string, TreeNodeWithChildren>();
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

    const cached = getCachedReadItems();
    const images = cached ?? readItems();
    if (!cached) {
      setCachedReadItems(images);
    }
    const imagesByCategory = new Map<string, typeof images>();
    for (const img of images) {
      const cat = img.category || "sans-categorie";
      if (!imagesByCategory.has(cat)) imagesByCategory.set(cat, []);
      imagesByCategory.get(cat)!.push(img);
    }

    const attachImages = (nodes: TreeNodeWithChildren[]): TreeNodeWithChildren[] => {
      return nodes.map((node) => {
        if (node.type === "directory" || node.type === "folder") {
          const matching = imagesByCategory.get(node.name) || [];
          const imageChildren: TreeNodeWithChildren[] = matching.map((img) => ({
            id: `image-${img.id}`,
            name: img.title || img.id,
            type: "image",
            metadata: JSON.stringify({
              id: img.id,
              title: img.title,
              category: img.category,
              mimeType: img.mimeType,
              size: img.size,
              createdAt: img.createdAt,
              updatedAt: img.updatedAt,
            }),
            parentId: node.id,
            order: 0,
            createdAt: img.createdAt,
            updatedAt: img.updatedAt,
            children: [],
          }));
          return {
            ...node,
            children: [...node.children, ...imageChildren],
          };
        }
        return {
          ...node,
          children: attachImages(node.children),
        };
      });
    };

    const mergedRoots = attachImages(roots);
    const apiRoots = mergedRoots.flatMap((node) =>
      node.type === "root" ? node.children : [node]
    );

    return NextResponse.json({ roots: apiRoots });
  } catch (error) {
    console.error("Failed to fetch tree:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const normalized = message.toLowerCase();
    const isDbUnavailable =
      normalized.includes("can't reach database server") ||
      normalized.includes("connection") ||
      normalized.includes("timeout") ||
      normalized.includes("prisma client initializationerror");

    if (isDbUnavailable) {
      console.error("[Tree] database unavailable:", message);
      return NextResponse.json(
        {
          error: "database_unavailable",
          message: "La base de données web est indisponible pour le moment.",
          details: message,
        },
        { status: 503 }
      );
    }

    console.error("[Tree] unexpected error:", message);
    return NextResponse.json(
      { error: "Failed to load tree", details: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prisma } = await import("@/lib/prisma");
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
        uuid: generateUUID(),
        name: body.name,
        type: body.type,
        metadata: body.metadata ?? null,
        parentId,
        order: nextOrder,
      },
    });
    return NextResponse.json(node, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Tree POST] error:", msg, error);
    const isDb = msg.toLowerCase().includes("database") || msg.toLowerCase().includes("connection") || msg.toLowerCase().includes("timeout");
    return NextResponse.json(
      { error: isDb ? "database_unavailable" : "Invalid node", details: msg },
      { status: isDb ? 503 : 400 }
    );
  }
}
