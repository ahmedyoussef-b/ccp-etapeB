import { NextResponse } from "next/server";
import { getAllItems } from "@/lib/images/server-store-prisma";

type ImageNode = {
  id: string;
  name: string;
  type: "directory" | "file" | "image";
  path: string;
  children: ImageNode[];
  size?: number;
  createdAt: string;
  updatedAt: string;
};

function buildTreeFromPaths(items: Array<{ category: string; id: string; title: string; size: number; createdAt: string; updatedAt: string }>): ImageNode[] {
  const root: ImageNode = { id: "root", name: "Banque d'images", type: "directory", path: "", children: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

  for (const item of items) {
    const parts = item.category.split("/").filter(Boolean);
    let current = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = current.children.find((c) => c.name === part && c.type === "directory");

      if (existing) {
        current = existing;
      } else {
        const newNode: ImageNode = {
          id: `dir-${currentPath}`,
          name: part,
          type: "directory",
          path: currentPath,
          children: [],
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
        current.children.push(newNode);
        current = newNode;
      }
    }

    current.children.push({
      id: item.id,
      name: item.title || item.id,
      type: "image",
      path: item.category,
      children: [],
      size: item.size,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }

  const sortNodes = (nodes: ImageNode[]): ImageNode[] => {
    return nodes
      .sort((a, b) => {
        const typeOrder = { directory: 0, image: 1, file: 2 };
        const aOrder = typeOrder[a.type] ?? 99;
        const bOrder = typeOrder[b.type] ?? 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      })
      .map((node) => ({ ...node, children: sortNodes(node.children) }));
  };

  return sortNodes(root.children);
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await getAllItems();
    const roots = buildTreeFromPaths(items);
    return NextResponse.json({ roots });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[ImagesTree] Failed to load image tree:", message);
    return NextResponse.json(
      { error: "Failed to load image tree", details: message, roots: [] },
      { status: 200 }
    );
  }
}
