import { NextResponse } from "next/server";
import { getMeeting } from "@/lib/meetings";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const meeting = getMeeting(params.id);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    return NextResponse.json({ meeting });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get meeting" },
      { status: 500 }
    );
  }
}
