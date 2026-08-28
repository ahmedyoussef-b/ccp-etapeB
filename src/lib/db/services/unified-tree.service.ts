import type { UnifiedTreeNode, TreeNodeDisplay, TreeNodeSource, TreeNodeSyncStatus, TreeNodeIndexStatus } from '../types/unified-tree-node';
import { buildWebTree } from '../mappers/web-tree.mapper';
import { buildSQLiteTree } from '../mappers/sqlite-tree.mapper';
import { buildVectorTree } from '../mappers/vector-tree.mapper';
import type { LocalTreeRow } from '@/lib/db/db';

export class UnifiedTreeService {
  static async loadWebTree(): Promise<UnifiedTreeNode[]> {
    const { prisma } = await import('@/lib/prisma');
    const nodes = await prisma.treeNode.findMany({
      orderBy: { order: 'asc' },
    });
    return buildWebTree(nodes);
  }

  static async loadLocalTree(): Promise<UnifiedTreeNode[]> {
    const { query } = await import('@/lib/client-engine/sqlite');
    const rows = await query<LocalTreeRow>(`
      SELECT id, uuid, remote_id, name, type, parent_id, node_order, path, size, content, metadata, sync_status, created_at, updated_at
      FROM local_tree
      WHERE deleted_at IS NULL
      ORDER BY parent_id, node_order
    `);
    return buildSQLiteTree(rows);
  }

  static async loadVectorTree(): Promise<UnifiedTreeNode[]> {
    const { getAllVectorTreeNodes } = await import('@/lib/client-engine/vector-store');
    const nodes = await getAllVectorTreeNodes();
    return buildVectorTree(nodes);
  }

  static toDisplay(node: UnifiedTreeNode): TreeNodeDisplay {
    const badges: TreeNodeDisplay['badges'] = [];

    if (node.source === 'web') {
      badges.push({ type: 'source', label: 'Web', variant: 'default' });
    } else if (node.source === 'local') {
      const isDirty = node.syncStatus === 'local-only' || node.syncStatus === 'pending';
      badges.push({ type: 'source', label: 'Local', variant: 'secondary' });
      if (isDirty) {
        badges.push({ type: 'sync', label: 'Non synchronisé', variant: 'outline' });
      }
    } else if (node.source === 'vector') {
      badges.push({ type: 'source', label: 'Vectoriel', variant: 'outline' });
      if (node.indexStatus === 'indexed') {
        badges.push({ type: 'index', label: 'Indexé', variant: 'default' });
      } else if (node.indexStatus === 'indexing') {
        badges.push({ type: 'index', label: 'Indexation...', variant: 'secondary' });
      }
    }

    if (node.syncStatus === 'conflict') {
      badges.push({ type: 'conflict', label: 'Conflit', variant: 'destructive' });
    }

    const isLocal = node.source === 'local';
    const isVector = node.source === 'vector';

    const result: TreeNodeDisplay = {
      ...node,
      webMetadata: {
        version: node.metadata['version'] as string | undefined,
        lastSyncAt: node.metadata['lastSyncAt'] as string | undefined,
        procedureCode: node.metadata['procedureCode'] as string | undefined,
      },
      localMetadata: {
        isDirty: isLocal && node.syncStatus !== 'synced',
        pendingSync: isLocal && node.syncStatus === 'pending',
        localPath: node.metadata['localPath'] as string | undefined,
        conflictType: node.syncStatus === 'conflict' ? (node.metadata['conflictType'] as 'modified' | 'deleted' | 'created' | undefined) : undefined,
      },
      vectorMetadata: {
        isIndexed: isVector && node.indexStatus === 'indexed',
        dimension: node.metadata['dimension'] as number | undefined,
        chunkCount: (node.metadata['chunkCount'] as number | undefined) ?? 0,
        lastIndexedAt: node.metadata['lastIndexedAt'] as string | undefined,
      },
      badges,
    };

    return result;
  }

  static mergeTrees(
    webNodes: UnifiedTreeNode[],
    localNodes: UnifiedTreeNode[],
    vectorNodes: UnifiedTreeNode[]
  ): UnifiedTreeNode[] {
    const merged = new Map<string, UnifiedTreeNode>();

    for (const node of webNodes) {
      merged.set(node.remoteId ?? node.id, node);
    }

    for (const local of localNodes) {
      const key = local.remoteId ?? local.id;
      const existing = merged.get(key);

      if (existing) {
        merged.set(key, {
          ...existing,
          source: existing.syncStatus === 'conflict' ? 'web' : 'local',
          syncStatus: local.syncStatus === 'pending' ? existing.syncStatus : local.syncStatus,
          localId: local.localId,
        });
      } else {
        merged.set(local.id, local);
      }
    }

    for (const vector of vectorNodes) {
      const key = vector.remoteId ?? vector.id;
      const existing = merged.get(key);

      if (existing) {
        merged.set(key, {
          ...existing,
          vectorId: vector.vectorId,
          docId: vector.docId,
          indexStatus: vector.indexStatus,
        });
      } else {
        merged.set(vector.id, vector);
      }
    }

    return Array.from(merged.values());
  }

  static filterBySource(nodes: UnifiedTreeNode[], source: TreeNodeSource | 'all'): UnifiedTreeNode[] {
    if (source === 'all') return nodes;
    return nodes.filter((node) => node.source === source);
  }

  static filterBySyncStatus(nodes: UnifiedTreeNode[], status: TreeNodeSyncStatus): UnifiedTreeNode[] {
    return nodes.filter((node) => node.syncStatus === status);
  }

  static filterByIndexStatus(nodes: UnifiedTreeNode[], status: TreeNodeIndexStatus): UnifiedTreeNode[] {
    return nodes.filter((node) => node.indexStatus === status);
  }

  static search(nodes: UnifiedTreeNode[], query: string): UnifiedTreeNode[] {
    if (!query.trim()) return nodes;
    const term = query.toLowerCase();

    const matches = (node: UnifiedTreeNode): boolean => {
      const nameMatch = node.name.toLowerCase().includes(term);
      const pathMatch = node.path.toLowerCase().includes(term);
      const childMatch = node.children.some(matches);
      return nameMatch || pathMatch || childMatch;
    };

    const prune = (items: UnifiedTreeNode[]): UnifiedTreeNode[] => {
      return items
        .filter(matches)
        .map((node) => ({
          ...node,
          children: prune(node.children),
        }));
    };

    return prune(nodes);
  }

  static getStats(nodes: UnifiedTreeNode[]): {
    total: number;
    bySource: Record<TreeNodeSource, number>;
    bySyncStatus: Record<TreeNodeSyncStatus, number>;
    byType: Record<string, number>;
  } {
    const bySource: Record<TreeNodeSource, number> = { web: 0, local: 0, vector: 0 };
    const bySyncStatus: Record<TreeNodeSyncStatus, number> = { synced: 0, 'local-only': 0, pending: 0, conflict: 0 };
    const byType: Record<string, number> = {};

    const count = (items: UnifiedTreeNode[]): void => {
      for (const node of items) {
        bySource[node.source] = (bySource[node.source] || 0) + 1;
        bySyncStatus[node.syncStatus] = (bySyncStatus[node.syncStatus] || 0) + 1;
        byType[node.type] = (byType[node.type] || 0) + 1;
        if (node.children.length > 0) {
          count(node.children);
        }
      }
    };

    count(nodes);

    return {
      total: bySource.web + bySource.local + bySource.vector,
      bySource,
      bySyncStatus,
      byType,
    };
  }

  static async getNodesModifiedSince(since: Date): Promise<UnifiedTreeNode[]> {
    const [webTree, localTree] = await Promise.all([
      this.loadWebTree(),
      this.loadLocalTree(),
    ]);

    const merged = this.mergeTrees(webTree, localTree, []);
    
    return merged.filter(node => {
      const updatedAt = new Date(node.updatedAt);
      return updatedAt > since;
    });
  }

  static async getSyncStats(): Promise<{
    totalWeb: number;
    totalLocal: number;
    synced: number;
    pending: number;
    localOnly: number;
    conflicts: number;
  }> {
    const [webTree, localTree] = await Promise.all([
      this.loadWebTree(),
      this.loadLocalTree(),
    ]);

    const merged = this.mergeTrees(webTree, localTree, []);
    const stats = this.getStats(merged);

    return {
      totalWeb: stats.bySource.web,
      totalLocal: stats.bySource.local,
      synced: stats.bySyncStatus.synced,
      pending: stats.bySyncStatus.pending,
      localOnly: stats.bySyncStatus['local-only'],
      conflicts: stats.bySyncStatus.conflict,
    };
  }
}
