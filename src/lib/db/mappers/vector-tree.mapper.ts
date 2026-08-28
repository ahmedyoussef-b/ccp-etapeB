import type { VectorTreeNode } from '@/lib/client-engine/vector-store';
import type { UnifiedTreeNode } from '../types/unified-tree-node';

export function fromVectorTreeNode(node: VectorTreeNode): UnifiedTreeNode {
  return {
    id: `vector-${node.id}`,
    name: node.name,
    type: normalizeType(node.type),
    parentId: node.parentId ? `vector-${node.parentId}` : null,
    order: node.order ?? 0,
    path: node.relativePath,
    content: node.content ?? null,
    metadata: {
      docId: node.docId,
      relativePath: node.relativePath,
    },
    source: 'vector',
    syncStatus: 'synced',
    vectorId: node.id,
    docId: node.docId ?? null,
    indexStatus: node.syncStatus === 'synced' ? 'indexed' : 'pending',
    children: [],
    createdAt: new Date(node.createdAt ?? Date.now()).toISOString(),
    updatedAt: new Date(node.updatedAt ?? Date.now()).toISOString(),
  };
}

function normalizeType(type: string): 'root' | 'directory' | 'file' {
  const normalized = type.toLowerCase();
  if (normalized === 'root') return 'root';
  if (normalized === 'folder' || normalized === 'directory') return 'directory';
  return 'file';
}

export function buildVectorTree(nodes: VectorTreeNode[]): UnifiedTreeNode[] {
  const map = new Map<string, UnifiedTreeNode>();
  const roots: UnifiedTreeNode[] = [];

  for (const node of nodes) {
    const unified = fromVectorTreeNode(node);
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
