import { NextResponse } from 'next/server';
import { syncTreeWebToLocal } from '@/lib/sync/mirror-sync.service';
import { query } from '@/lib/client-engine/sqlite';
import { buildTreeFromFlatRows, logTreeStructure, auditTree } from '@/lib/sync/tree-audit';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('[MirrorSync] start');
    
    const beforeRows = await query<{ id: number; uuid: string; name: string; type: string; parent_id: number | null; path: string }>(
      'SELECT id, uuid, name, type, parent_id, path FROM local_tree WHERE deleted_at IS NULL'
    );
    const beforeTree = buildTreeFromFlatRows(beforeRows);
    auditTree(beforeTree, 'MirrorSync:LocalTreeBefore');
    logTreeStructure(beforeTree, 'MirrorSync:LocalTreeStructureBefore', 4);
    
    const result = await syncTreeWebToLocal();
    
    const afterRows = await query<{ id: number; uuid: string; name: string; type: string; parent_id: number | null; path: string }>(
      'SELECT id, uuid, name, type, parent_id, path FROM local_tree WHERE deleted_at IS NULL'
    );
    const afterTree = buildTreeFromFlatRows(afterRows);
    auditTree(afterTree, 'MirrorSync:LocalTreeAfter');
    logTreeStructure(afterTree, 'MirrorSync:LocalTreeStructureAfter', 4);
    
    console.log('[MirrorSync] completed', {
      success: result.errors.length === 0,
      deleted: result.deleted,
      inserted: result.inserted,
      conflicts: result.conflicts,
      errors: result.errors,
    });

    return NextResponse.json({
      success: result.errors.length === 0,
      ...result,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[MirrorSync] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
