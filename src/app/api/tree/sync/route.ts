import { NextResponse } from 'next/server';
import { syncTreeWebToLocal } from '@/lib/sync/mirror-sync.service';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await syncTreeWebToLocal();
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
