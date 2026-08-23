import type { ApiNode } from './types';

export interface TreeNodeWithChildren {
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

export function adaptTreeNodeToApiNode(node: TreeNodeWithChildren): ApiNode {
  const base = {
    id: String(node.id),
    name: node.name,
    order: node.order,
  };

  if (node.type === 'directory' || node.type === 'root') {
    return {
      ...base,
      type: 'directory',
      children: node.children.map(adaptTreeNodeToApiNode),
    };
  }

  const metadata = node.metadata ? JSON.parse(node.metadata) : {};
  return {
    ...base,
    type: 'file',
    size: metadata.size || 0,
    content: metadata.content || null,
    metadata: node.metadata,
  };
}
