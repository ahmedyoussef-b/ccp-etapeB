import { NextResponse } from 'next/server';
import { getDb, run, query } from '@/lib/client-engine/sqlite';

export const dynamic = 'force-dynamic';

interface TreeNodeLike {
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

export async function POST() {
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({ error: 'SQLite not available' }, { status: 503 });
    }

    const treeRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/tree`, {
      cache: 'no-store',
    });
    if (!treeRes.ok) {
      throw new Error(`Failed to fetch web tree: ${treeRes.status}`);
    }
    const treeData = await treeRes.json();
    const webNodes = flattenTree((treeData as { roots: TreeNodeLike[] }).roots || []);
    console.log('[HardReset] web tree raw roots:', (treeData as { roots: TreeNodeLike[] }).roots?.length || 0);
    console.log('[HardReset] web tree flattened nodes:', webNodes.length);

    const beforeCount = await query<{ count: number }>('SELECT COUNT(*) as count FROM local_tree');
    console.log('[HardReset] local_tree count before delete:', beforeCount[0]?.count ?? 0);

    await run('DELETE FROM local_tree');

    let inserted = 0;
    let failed = 0;
    for (const node of webNodes) {
      try {
        await run(
          `INSERT INTO local_tree (uuid, name, type, parent_id, node_order, path, size, content, sync_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', datetime('now'), datetime('now'))`,
          [
            String(node.id),
            node.name,
            node.type,
            node.parentId ?? null,
            node.order ?? 0,
            node.path || node.name,
            node.size || 0,
            node.content ?? null,
          ]
        );
        inserted++;
      } catch (err) {
        failed++;
        console.error('[HardReset] insert failed', node.id, err);
      }
    }

    const afterCount = await query<{ count: number }>('SELECT COUNT(*) as count FROM local_tree');
    console.log('[HardReset] local_tree count after insert:', afterCount[0]?.count ?? 0);

    return NextResponse.json({ 
      success: true, 
      inserted, 
      failed,
      total: webNodes.length,
      beforeCount: beforeCount[0]?.count ?? 0,
      afterCount: afterCount[0]?.count ?? 0,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[HardReset] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
