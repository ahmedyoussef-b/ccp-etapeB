import { NextResponse } from "next/server";
import { getById, update, remove } from "@/lib/etat-des-lieux/server-store";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const report = await getById(params.id);
  if (!report) {
    return NextResponse.json({ message: "Report not found" }, { status: 404 });
  }
  return NextResponse.json(report);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const report = await update(params.id, body);
    if (!report) {
      return NextResponse.json({ message: "Report not found" }, { status: 404 });
    }
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const success = await remove(params.id);
  if (!success) {
    return NextResponse.json({ message: "Report not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
