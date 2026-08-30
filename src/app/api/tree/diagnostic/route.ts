import { NextResponse } from 'next/server';
import { query } from '@/lib/client-engine/sqlite';

export const dynamic = 'force-dynamic';

interface TreeNodeLike {
  id: number | string;
  name: string;
  type: string;
  parentId: number | string | null;
  path?: string;
  children?: TreeNodeLike[];
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

function countNodes(nodes: TreeNodeLike[]): number {
  return nodes.reduce((acc, node) => acc + 1 + countNodes(node.children || []), 0);
}

export async function GET() {
  try {
    const [treeRes, sqliteRows] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/tree`, {
        cache: 'no-store',
      }),
      query<{ id: number; uuid: string; name: string; type: string; parent_id: number | null; path: string }>(
        'SELECT id, uuid, name, type, parent_id, path FROM local_tree WHERE deleted_at IS NULL'
      ),
    ]);

    const treeData = await treeRes.json();
    const webNodes = flattenTree((treeData as { roots: TreeNodeLike[] }).roots || []);
    const webCount = countNodes((treeData as { roots: TreeNodeLike[] }).roots || []);
    const sqliteCount = sqliteRows.length;

    const webPaths = new Set(webNodes.map(n => n.path || n.name));
    const sqlitePaths = new Set(sqliteRows.map(r => r.path || r.name));

    const onlyInSqlite = [...sqlitePaths].filter(p => !webPaths.has(p));
    const onlyInWeb = [...webPaths].filter(p => !sqlitePaths.has(p));

    return NextResponse.json({
      web: {
        totalRaw: webCount,
        totalFlattened: webNodes.length,
        samplePaths: [...webPaths].slice(0, 20),
      },
      sqlite: {
        total: sqliteCount,
        samplePaths: [...sqlitePaths].slice(0, 20),
      },
      diff: {
        onlyInSqlite: onlyInSqlite.length,
        onlyInWeb: onlyInWeb.length,
        onlyInSqlitePaths: onlyInSqlite,
        onlyInWebPaths: onlyInWeb,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Diagnostic] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
