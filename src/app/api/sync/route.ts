import { NextResponse } from 'next/server';
import { incrementalSync } from '@/lib/sync/incremental-sync.service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode = body.mode || 'full';

    if (mode === 'full') {
      const report = await incrementalSync.fullSync({
        forceVectorize: body.force || false,
      });
      return NextResponse.json(report);
    }

    if (mode === 'incremental') {
      const since = body.since ? new Date(body.since) : undefined;
      const report = await incrementalSync.syncWebToLocal({ since });
      return NextResponse.json(report);
    }

    if (mode === 'vectorize-only') {
      const report = await incrementalSync.vectorizeLocalToVector({
        force: body.force || false,
        batchSize: body.batchSize || 50,
      });
      return NextResponse.json(report);
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    console.error('Sync failed:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
