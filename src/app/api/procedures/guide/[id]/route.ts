import { NextResponse } from "next/server";
import { offlineRepo } from "@/lib/procedures/offline-repo";

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const procedure = await offlineRepo.getById(params.id);
  if (!procedure) {
    return NextResponse.json({ message: "Procedure not found" }, { status: 404 });
  }
  return NextResponse.json(procedure);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  await offlineRepo.delete(params.id);
  return NextResponse.json({ success: true }, { status: 200 });
}
