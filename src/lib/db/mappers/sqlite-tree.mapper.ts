import type { LocalTreeRow } from '@/lib/db/db';
import type { UnifiedTreeNode } from '../types/unified-tree-node';

export function fromSQLiteLocalTree(row: LocalTreeRow): UnifiedTreeNode {
  return {
    id: `local-${row.id}`,
    name: row.name,
    type: normalizeType(row.type),
    parentId: row.parent_id ? `local-${row.parent_id}` : null,
    order: row.node_order ?? 0,
    path: row.path ?? row.name,
    size: row.size ?? 0,
    content: row.content,
    metadata: parseMetadata(row.metadata),
    source: 'local',
    syncStatus: normalizeSyncStatus(row.sync_status),
    remoteId: row.remote_id ?? undefined,
    localId: row.id,
    children: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeType(type: string): 'root' | 'directory' | 'file' {
  const normalized = type.toLowerCase();
  if (normalized === 'folder' || normalized === 'directory') return 'directory';
  if (normalized === 'root') return 'root';
  return 'file';
}

function normalizeSyncStatus(status: string): 'synced' | 'local-only' | 'pending' | 'conflict' {
  const normalized = status.toLowerCase();
  if (normalized === 'synced') return 'synced';
  if (normalized === 'local_only' || normalized === 'local-only') return 'local-only';
  if (normalized === 'conflict') return 'conflict';
  return 'pending';
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

export function buildSQLiteTree(rows: LocalTreeRow[]): UnifiedTreeNode[] {
  const map = new Map<number, UnifiedTreeNode>();
  const roots: UnifiedTreeNode[] = [];

  for (const row of rows) {
    const unified = fromSQLiteLocalTree(row);
    map.set(row.id, unified);
  }

  for (const row of rows) {
    const unified = map.get(row.id)!;
    if (row.parent_id !== null && map.has(row.parent_id)) {
      map.get(row.parent_id)!.children.push(unified);
    } else {
      roots.push(unified);
    }
  }

  return roots;
}
