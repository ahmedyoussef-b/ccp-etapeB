import { NextResponse } from "next/server";
import { getById, update, remove } from "@/lib/images/server-store";

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
  return NextResponse.json(item);
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
