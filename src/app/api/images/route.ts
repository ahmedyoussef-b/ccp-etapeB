import { NextResponse } from "next/server";
import { getAll, create, getCategories } from "@/lib/images/server-store";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [items, categories] = await Promise.all([getAll(), getCategories()]);
    return NextResponse.json({ items, categories });
  } catch {
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const item = await create(body);
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
}