import { NextResponse } from "next/server";
import { getById, update, remove } from "@/lib/images/server-store";

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const item = await getById(params.id);
  if (!item) {
    return NextResponse.json({ message: "Image not found" }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const item = await update(params.id, body);
    if (!item) {
      return NextResponse.json({ message: "Image not found" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid data";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const success = await remove(params.id);
  if (!success) {
    return NextResponse.json({ message: "Image not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
