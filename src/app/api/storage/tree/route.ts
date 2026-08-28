import { NextResponse } from 'next/server';
import { UnifiedTreeService } from '@/lib/db/services/unified-tree.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') as 'web' | 'local' | 'vector' | 'all' | null;

    const [webTree, localTree, vectorTree] = await Promise.all([
      UnifiedTreeService.loadWebTree(),
      UnifiedTreeService.loadLocalTree(),
      UnifiedTreeService.loadVectorTree(),
    ]);

    const merged = UnifiedTreeService.mergeTrees(webTree, localTree, vectorTree);

    if (source && source !== 'all') {
      const filtered = UnifiedTreeService.filterBySource(merged, source);
      return NextResponse.json({ nodes: filtered, total: filtered.length });
    }

    return NextResponse.json({ nodes: merged, total: merged.length });
  } catch (error) {
    console.error('Failed to fetch unified tree:', error);
    return NextResponse.json({ error: 'Failed to load tree' }, { status: 500 });
  }
}
