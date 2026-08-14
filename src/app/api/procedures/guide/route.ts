import { NextResponse } from "next/server";
import { offlineRepo } from "@/lib/procedures/offline-repo";

export async function GET() {
  const procedures = await offlineRepo.getAll();
  return NextResponse.json(procedures);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await offlineRepo.save(body);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, message: "Invalid procedure" }, { status: 400 });
  }
}
