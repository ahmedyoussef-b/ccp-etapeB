export type TreeNodeSource = 'web' | 'local' | 'vector';

export type TreeNodeSyncStatus = 'synced' | 'local-only' | 'pending' | 'conflict';

export type TreeNodeIndexStatus = 'indexed' | 'pending' | 'indexing' | 'error';

export interface UnifiedTreeNode {
  id: string;
  name: string;
  type: 'root' | 'directory' | 'file';
  parentId: string | null;
  order: number;
  path: string;
  size?: number;
  content?: string | null;
  metadata: Record<string, unknown>;
  source: TreeNodeSource;
  syncStatus: TreeNodeSyncStatus;
  remoteId?: string;
  localId?: number;
  vectorId?: string;
  docId?: string | null;
  indexStatus?: TreeNodeIndexStatus;
  children: UnifiedTreeNode[];
  createdAt: string;
  updatedAt: string;
}

export interface TreeNodeDisplay extends UnifiedTreeNode {
  webMetadata: {
    version?: string;
    lastSyncAt?: string;
    procedureCode?: string;
  };
  localMetadata: {
    isDirty: boolean;
    pendingSync: boolean;
    localPath?: string;
    conflictType?: 'modified' | 'deleted' | 'created';
  };
  vectorMetadata: {
    isIndexed: boolean;
    dimension?: number;
    chunkCount: number;
    lastIndexedAt?: string;
  };
  badges: Array<{
    type: 'sync' | 'index' | 'source' | 'conflict';
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  }>;
}
