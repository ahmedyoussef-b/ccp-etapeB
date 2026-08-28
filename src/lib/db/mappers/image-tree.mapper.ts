import type { MediaItem } from '@/lib/images/server-store-prisma';
import type { UnifiedTreeNode } from '../types/unified-tree-node';

export function fromMediaItem(item: MediaItem, parentId: string | null = null): UnifiedTreeNode {
  return {
    id: `image-${item.id}`,
    name: item.title || item.id,
    type: 'file',
    parentId,
    order: 0,
    path: `${item.category}/${item.title || item.id}`,
    size: item.size,
    content: null,
    metadata: {
      kind: item.kind,
      mimeType: item.mimeType,
      category: item.category,
      description: item.description,
      tags: item.tags,
      geolocation: item.geolocation,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      hasMedia: true,
      thumbnailUrl: item.thumbnailDataUrl || null,
    },
    source: 'web',
    syncStatus: 'synced',
    remoteId: item.id,
    children: [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function buildImageTree(items: MediaItem[]): UnifiedTreeNode[] {
  const byCategory = new Map<string, UnifiedTreeNode[]>();
  const roots: UnifiedTreeNode[] = [];

  for (const item of items) {
    const category = item.category || 'sans-categorie';
    const node = fromMediaItem(item);

    if (!byCategory.has(category)) {
      const folder: UnifiedTreeNode = {
        id: `image-category-${category}`,
        name: category,
        type: 'directory',
        parentId: null,
        order: 0,
        path: category,
        metadata: {},
        source: 'web',
        syncStatus: 'synced',
        children: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      roots.push(folder);
      byCategory.set(category, []);
    }

    byCategory.get(category)!.push(node);
  }

  for (const [category, nodes] of byCategory) {
    const folder = roots.find(r => r.id === `image-category-${category}`);
    if (folder) {
      folder.children = nodes;
    }
  }

  return roots;
}
