import { getDb, query, run } from '@/lib/client-engine/sqlite';

export interface TreeNodeLike {
  id: number | string;
  name: string;
  type: string;
  parentId: number | string | null;
  order: number;
  path: string;
  size?: number;
  content?: string | null;
  children: TreeNodeLike[];
}

export interface SyncResult {
  deleted: number;
  inserted: number;
  conflicts: number;
  errors: string[];
}

function flattenTree(nodes: TreeNodeLike[]): TreeNodeLike[] {
  const result: TreeNodeLike[] = [];
  for (const node of nodes) {
    if (node.type === 'image') continue;
    result.push(node);
    if (node.children && node.children.length > 0) {
      result.push(...flattenTree(node.children));
    }
  }
  return result;
}

export async function syncTreeWebToLocal(): Promise<SyncResult> {
  const result: SyncResult = {
    deleted: 0,
    inserted: 0,
    conflicts: 0,
    errors: [],
  };

  try {
    const db = getDb();
    if (!db) {
      result.errors.push('SQLite not initialized');
      return result;
    }

    const treeRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/tree`, {
      cache: 'no-store',
    });
    if (!treeRes.ok) {
      throw new Error(`Failed to fetch web tree: ${treeRes.status}`);
    }
    const treeData = await treeRes.json();
    const webNodes = flattenTree((treeData as { roots: TreeNodeLike[] }).roots || []);
    const webMap = new Map<string, TreeNodeLike>();
    for (const node of webNodes) {
      webMap.set(node.path || node.name, node);
    }

    const localRows = await query<{ id: number; uuid: string; name: string; type: string; parent_id: number | null; path: string }>(
      'SELECT id, uuid, name, type, parent_id, path FROM local_tree WHERE deleted_at IS NULL'
    );
    const localMap = new Map<string, { id: number; uuid: string; type: string }>();
    for (const row of localRows) {
      localMap.set(row.path || row.name, { id: row.id, uuid: row.uuid, type: row.type });
    }

    const webPaths = new Set(webMap.keys());
    const localPaths = new Set(localMap.keys());

    for (const path of localPaths) {
      if (!webPaths.has(path)) {
        const local = localMap.get(path);
        if (local) {
          await run('DELETE FROM local_tree WHERE id = ?', [local.id]);
          result.deleted++;
        }
      }
    }

    for (const [path, webNode] of webMap) {
      const local = localMap.get(path);
      if (!local) {
        await run(
          `INSERT INTO local_tree (uuid, name, type, parent_id, node_order, path, size, content, sync_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', datetime('now'), datetime('now'))`,
          [
            String(webNode.id),
            webNode.name,
            webNode.type,
            webNode.parentId ?? null,
            webNode.order ?? 0,
            webNode.path || webNode.name,
            webNode.size || 0,
            webNode.content ?? null,
          ]
        );
        result.inserted++;
      } else {
        if (local.type !== webNode.type) {
          result.conflicts++;
          await run(
            `UPDATE local_tree SET type = ?, name = ?, parent_id = ?, node_order = ?, path = ?, size = ?, content = ?, sync_status = 'synced', updated_at = datetime('now') WHERE id = ?`,
            [
              webNode.type,
              webNode.name,
              webNode.parentId ?? null,
              webNode.order ?? 0,
              webNode.path || webNode.name,
              webNode.size || 0,
              webNode.content ?? null,
              local.id,
            ]
          );
        }
      }
    }

    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(msg);
    return result;
  }
}
