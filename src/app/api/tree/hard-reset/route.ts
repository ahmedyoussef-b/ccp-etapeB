import { NextResponse } from 'next/server';
import { getDb, run, query } from '@/lib/client-engine/sqlite';
import { flattenTree, auditTree, logTreeStructure, buildTreeFromFlatRows, type TreeNodeLike } from '@/lib/sync/tree-audit';

export const dynamic = 'force-dynamic';

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
    const webRoots = (treeData as { roots: TreeNodeLike[] }).roots || [];
    
    auditTree(webRoots, 'HardReset:WebTreeBefore');
    logTreeStructure(webRoots, 'HardReset:WebTreeStructureBefore', 4);
    
    const webNodes = flattenTree(webRoots);
    console.log('[HardReset] web tree raw roots:', webRoots.length);
    console.log('[HardReset] web tree flattened nodes:', webNodes.length);

    const beforeCount = await query<{ count: number }>('SELECT COUNT(*) as count FROM local_tree');
    console.log('[HardReset] local_tree count before delete:', beforeCount[0]?.count ?? 0);
    
    const beforeRows = await query<{ id: number; uuid: string; name: string; type: string; parent_id: number | null; path: string }>(
      'SELECT id, uuid, name, type, parent_id, path FROM local_tree WHERE deleted_at IS NULL'
    );
    const beforeTree = buildTreeFromFlatRows(beforeRows);
    auditTree(beforeTree, 'HardReset:LocalTreeBefore');
    logTreeStructure(beforeTree, 'HardReset:LocalTreeStructureBefore', 4);
    
    const beforeSample = await query<{ path: string }>('SELECT path FROM local_tree WHERE deleted_at IS NULL LIMIT 10');
    console.log('[HardReset] local_tree sample paths before:', beforeSample.map(r => r.path));

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
    
    const afterRows = await query<{ id: number; uuid: string; name: string; type: string; parent_id: number | null; path: string }>(
      'SELECT id, uuid, name, type, parent_id, path FROM local_tree WHERE deleted_at IS NULL'
    );
    const afterTree = buildTreeFromFlatRows(afterRows);
    auditTree(afterTree, 'HardReset:LocalTreeAfter');
    logTreeStructure(afterTree, 'HardReset:LocalTreeStructureAfter', 4);
    
    const afterSample = await query<{ path: string }>('SELECT path FROM local_tree WHERE deleted_at IS NULL LIMIT 10');
    console.log('[HardReset] local_tree sample paths after:', afterSample.map(r => r.path));

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

