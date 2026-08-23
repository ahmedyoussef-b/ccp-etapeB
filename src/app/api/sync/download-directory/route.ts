import { NextRequest, NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

async function buildTree(prisma: PrismaClient, parentId: number | null): Promise<TreeNodeWithChildren[]> {
  console.log(`[NexaFlow][DownloadDirectory] buildTree parentId: ${parentId}`);

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
      item.children = await buildTree(prisma, node.id);
    }

    result.push(item);
  }

  return result;
}

function countNodes(node: TreeNodeWithChildren): number {
  let count = 1;
  for (const child of node.children) {
    count += countNodes(child);
  }
  return count;
}

export async function POST(request: NextRequest) {
  console.log('[NexaFlow][DownloadDirectory] Début du téléchargement sélectif');

  try {
    const { directoryId } = await request.json();

    if (!directoryId) {
      console.warn('[NexaFlow][DownloadDirectory] Paramètre manquant');
      return NextResponse.json(
        { error: 'Paramètre requis : directoryId' },
        { status: 400 }
      );
    }

    const { prisma } = await import("@/lib/prisma");

    const rootNode = await prisma.treeNode.findUnique({
      where: { id: Number(directoryId) },
    });

    if (!rootNode) {
      console.warn(`[NexaFlow][DownloadDirectory] Répertoire introuvable: ${directoryId}`);
      return NextResponse.json(
        { error: 'Répertoire introuvable' },
        { status: 404 }
      );
    }

    console.log(`[NexaFlow][DownloadDirectory] Téléchargement de : ${rootNode.name} (id: ${rootNode.id})`);

    const rootItem: TreeNodeWithChildren = {
      id: rootNode.id,
      name: rootNode.name,
      type: rootNode.type,
      metadata: rootNode.metadata,
      parentId: rootNode.parentId,
      order: rootNode.order,
      createdAt: rootNode.createdAt.toISOString(),
      updatedAt: rootNode.updatedAt.toISOString(),
      children: [],
    };

    if (rootNode.type === "directory" || rootNode.type === "root") {
      rootItem.children = await buildTree(prisma, rootNode.id);
    }

    const totalNodes = countNodes(rootItem);
    console.log(`[NexaFlow][DownloadDirectory] ${totalNodes} nœuds trouvés`);

    const { adaptTreeNodeToApiNode } = await import('@/lib/sync/adapters');
    const adaptedTree = adaptTreeNodeToApiNode(rootItem);

    return NextResponse.json({
      success: true,
      directory: adaptedTree,
      count: totalNodes,
      timestamp: new Date().toISOString(),
      message: `Téléchargement de ${totalNodes} éléments`
    });

  } catch (error) {
    console.error('[NexaFlow][DownloadDirectory] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors du téléchargement du répertoire' },
      { status: 500 }
    );
  }
}
