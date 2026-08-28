import { NextResponse } from 'next/server';
import { getItemById } from '@/lib/images/server-store-prisma';
import { resolveDataUrl } from '@/lib/images/server-store';
import type { MediaItem as DiskMediaItem } from '@/lib/images/server-store';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const item = await getItemById(params.id);
    if (!item) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    let dataUrl = item.dataUrl;
    if (!dataUrl && item.thumbnailDataUrl) {
      dataUrl = item.thumbnailDataUrl;
    }
    if (!dataUrl) {
      dataUrl = resolveDataUrl(item as DiskMediaItem);
    }

    return NextResponse.json({
      dataUrl,
      mimeType: item.mimeType,
      size: item.size,
      kind: item.kind,
      title: item.title,
    });
  } catch (error) {
    console.error(`[API][GET /api/media/${params.id}] error:`, error);
    return NextResponse.json({ error: 'Failed to load media' }, { status: 500 });
  }
}
