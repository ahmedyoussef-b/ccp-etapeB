import type { TreeNode as PrismaTreeNode } from '@prisma/client';
import type { UnifiedTreeNode } from '../types/unified-tree-node';

export function fromPrismaTreeNode(node: PrismaTreeNode): UnifiedTreeNode {
  const metadata = parseMetadata(node.metadata);

  return {
    id: `web-${node.id}`,
    name: node.name,
    type: node.type,
    parentId: node.parentId ? `web-${node.parentId}` : null,
    order: node.order,
    path: (metadata['path'] as string | undefined) ?? node.name,
    size: metadata['size'] as number | undefined,
    content: metadata['content'] as string | null | undefined,
    metadata,
    source: 'web',
    syncStatus: mapSyncStatus(node.syncStatus),
    remoteId: node.uuid,
    children: [],
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
  };
}

function mapSyncStatus(status: string): 'synced' | 'local-only' | 'pending' | 'conflict' {
  const normalized = status.toLowerCase();
  if (normalized === 'synced') return 'synced';
  if (normalized === 'local_only' || normalized === 'local-only') return 'local-only';
  if (normalized === 'conflict') return 'conflict';
  return 'pending';
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { raw };
  }
}

export function buildWebTree(nodes: PrismaTreeNode[]): UnifiedTreeNode[] {
  const map = new Map<number, UnifiedTreeNode>();
  const roots: UnifiedTreeNode[] = [];

  for (const node of nodes) {
    const unified = fromPrismaTreeNode(node);
    map.set(node.id, unified);
  }

  for (const node of nodes) {
    const unified = map.get(node.id)!;
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(unified);
    } else {
      roots.push(unified);
    }
  }

  return roots;
}
