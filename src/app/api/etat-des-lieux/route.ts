import { NextResponse } from "next/server";
import { getAll, create } from "@/lib/etat-des-lieux/server-store";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const reports = await getAll();
    return NextResponse.json({ reports });
  } catch {
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const report = await create(body);
    return NextResponse.json(report, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
}
