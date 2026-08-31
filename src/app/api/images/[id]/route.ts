import { NextResponse } from "next/server";
import { getItemById, updateItem, deleteItem } from "@/lib/images/server-store-prisma";
import type { MediaItem } from "@/lib/images/server-store-prisma";
import { invalidateReadItemsCache } from "@/lib/cache/media-items-cache";

type MediaItemWithoutDataUrl = Omit<MediaItem, 'dataUrl'>;

function withoutDataUrl(item: MediaItem): MediaItemWithoutDataUrl {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { dataUrl, ...rest } = item;
  return rest as MediaItemWithoutDataUrl;
}

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  console.log(`[API][GET /api/images/${params.id}] - fetching item`);
  const item = await getItemById(params.id);
  if (!item) {
    console.log(`[API][GET /api/images/${params.id}] - NOT FOUND`);
    return NextResponse.json({ message: "Image not found" }, { status: 404 });
  }
  console.log(`[API][GET /api/images/${params.id}] - found: ${item.title}`);
  return NextResponse.json(withoutDataUrl(item));
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log(`[API][PUT /api/images/${params.id}] - updating item`);
  try {
    const body = await request.json();
    console.log(`[API][PUT /api/images/${params.id}] - fields=${Object.keys(body).join(",")}`);
    const item = await updateItem(params.id, body);
    if (!item) {
      console.log(`[API][PUT /api/images/${params.id}] - NOT FOUND`);
      return NextResponse.json({ message: "Image not found" }, { status: 404 });
    }
    invalidateReadItemsCache();
    console.log(`[API][PUT /api/images/${params.id}] - updated: ${item.title}`);
    return NextResponse.json(withoutDataUrl(item));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid data";
    console.error(`[API][PUT /api/images/${params.id}] - ERROR:`, message, error);
    const stack = error instanceof Error ? error.stack : undefined;
    if (stack) console.error(`[API][PUT /api/images/${params.id}] - STACK:`, stack);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  console.log(`[API][DELETE /api/images/${params.id}] - deleting item`);
    const success = await deleteItem(params.id);
    if (!success) {
      console.log(`[API][DELETE /api/images/${params.id}] - NOT FOUND`);
      return NextResponse.json({ message: "Image not found" }, { status: 404 });
    }
    invalidateReadItemsCache();
    console.log(`[API][DELETE /api/images/${params.id}] - deleted successfully`);
  return NextResponse.json({ success: true });
}
