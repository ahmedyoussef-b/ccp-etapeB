import { NextResponse } from "next/server";
import { getMeeting } from "@/lib/meetings";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const meeting = getMeeting(params.id);
    if (!meeting) {
      console.log("[Meetings] GET /api/meetings/:id - Réunion introuvable", { meetingId: params.id });
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    console.log("[Meetings] GET /api/meetings/:id - Détail réunion", { meetingId: meeting.id, roomName: meeting.roomName, invitees: meeting.invitees.length });
    return NextResponse.json({ meeting });
  } catch (error) {
    console.error("[Meetings] Erreur GET /api/meetings/:id", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get meeting" },
      { status: 500 }
    );
  }
}
