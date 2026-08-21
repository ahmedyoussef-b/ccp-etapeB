import { NextResponse } from "next/server";
import { getById, update, remove, getMediaDir } from "@/lib/images/server-store";
import fs from "fs";
import path from "path";
import type { MediaItem } from "@/lib/images/server-store";

const MEDIA_DIR = getMediaDir();

function resolveDataUrl(item: MediaItem): string {
  if (item.dataUrl) return item.dataUrl;
  const itemDir = path.join(MEDIA_DIR, item.category || "sans-categorie", `${(item.title || item.id).replace(/[^a-zA-Z0-9_-]/g, "_")}_${item.id}`);
  const dataPath = path.join(itemDir, "data");
  if (fs.existsSync(dataPath)) {
    const buffer = fs.readFileSync(dataPath);
    return `data:${item.mimeType};base64,${buffer.toString("base64")}`;
  }
  return "";
}

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  console.log(`[API][GET /api/images/${params.id}] - fetching item`);
  const item = await getById(params.id);
  if (!item) {
    console.log(`[API][GET /api/images/${params.id}] - NOT FOUND`);
    return NextResponse.json({ message: "Image not found" }, { status: 404 });
  }
  console.log(`[API][GET /api/images/${params.id}] - found: ${item.title}`);
  const itemWithData = { ...item, dataUrl: resolveDataUrl(item) };
  return NextResponse.json(itemWithData);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log(`[API][PUT /api/images/${params.id}] - updating item`);
  try {
    const body = await request.json();
    console.log(`[API][PUT /api/images/${params.id}] - fields=${Object.keys(body).join(",")}`);
    const item = await update(params.id, body);
    if (!item) {
      console.log(`[API][PUT /api/images/${params.id}] - NOT FOUND`);
      return NextResponse.json({ message: "Image not found" }, { status: 404 });
    }
    console.log(`[API][PUT /api/images/${params.id}] - updated: ${item.title}`);
    return NextResponse.json(item);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid data";
    console.log(`[API][PUT /api/images/${params.id}] - ERROR: ${message}`);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  console.log(`[API][DELETE /api/images/${params.id}] - deleting item`);
  const success = await remove(params.id);
  if (!success) {
    console.log(`[API][DELETE /api/images/${params.id}] - NOT FOUND`);
    return NextResponse.json({ message: "Image not found" }, { status: 404 });
  }
  console.log(`[API][DELETE /api/images/${params.id}] - deleted successfully`);
  return NextResponse.json({ success: true });
}
