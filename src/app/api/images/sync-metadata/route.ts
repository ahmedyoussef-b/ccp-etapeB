import { NextResponse } from "next/server";
import { getAll } from "@/lib/images/server-store";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await getAll();
    const metadata = items.map((item) => {
      const { dataUrl, thumbnailDataUrl, ...rest } = item;
      void dataUrl;
      void thumbnailDataUrl;
      return rest;
    });
    return NextResponse.json({ images: metadata });
  } catch (error) {
    console.log(`[API][GET /api/images/sync-metadata] - ERROR: ${(error as Error).message}`);
    return NextResponse.json({ error: "Failed to fetch image metadata" }, { status: 500 });
  }
}
