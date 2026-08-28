import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { prisma } = await import('@/lib/prisma');

    const [
      procedureCount,
      mediaCount,
      qaCount,
      treeNodeCount,
      executionCount,
      latestTreeNode,
    ] = await Promise.all([
      prisma.procedure.count(),
      prisma.mediaItem.count(),
      prisma.qAPair.count(),
      prisma.treeNode.count(),
      prisma.procedureExecution.count(),
      prisma.treeNode.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    ]);

    return NextResponse.json({
      web: {
        procedures: procedureCount,
        media: mediaCount,
        qaPairs: qaCount,
        treeNodes: treeNodeCount,
        executions: executionCount,
        lastUpdated: latestTreeNode?.updatedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error('Failed to fetch web status:', error);
    return NextResponse.json({ error: 'Failed to load status' }, { status: 500 });
  }
}
