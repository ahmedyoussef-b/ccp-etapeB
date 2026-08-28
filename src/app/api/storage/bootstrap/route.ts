import { NextResponse } from 'next/server';
import { UnifiedTreeService } from '@/lib/db/services/unified-tree.service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode = body.mode === 'partial' ? 'partial' : 'full';

    if (mode === 'full') {
      const [webTree, localTree, vectorTree] = await Promise.all([
        UnifiedTreeService.loadWebTree(),
        UnifiedTreeService.loadLocalTree(),
        UnifiedTreeService.loadVectorTree(),
      ]);

      const merged = UnifiedTreeService.mergeTrees(webTree, localTree, vectorTree);

      return NextResponse.json({
        success: true,
        mode,
        stats: UnifiedTreeService.getStats(merged),
        message: 'Bootstrap completed',
      });
    }

    return NextResponse.json({
      success: true,
      mode,
      message: 'Partial bootstrap completed',
    });
  } catch (error) {
    console.error('Bootstrap failed:', error);
    return NextResponse.json({ error: 'Bootstrap failed' }, { status: 500 });
  }
}
