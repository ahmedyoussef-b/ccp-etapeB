import { NextResponse } from "next/server";
import { getClientUser } from "@/lib/procedures/client-auth";
import { createMeeting, listMeetings } from "@/lib/meetings";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = getClientUser();
    if (!user) {
      console.log("[Meetings] POST /api/meetings - Utilisateur non connecté");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const roomName = typeof body.roomName === "string" ? body.roomName.trim() : "";
    const invitees = Array.isArray(body.invitees) ? body.invitees : [];

    if (!roomName) {
      console.log("[Meetings] POST /api/meetings - roomName manquant");
      return NextResponse.json({ error: "roomName is required" }, { status: 400 });
    }

    console.log("[Meetings] POST /api/meetings - Création de réunion", { userId: user.userId, roomName, inviteeCount: invitees.length });

    const meeting = createMeeting({
      id: `meeting_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      roomName,
      createdBy: user.userId,
      createdByName: `${user.role}.${user.userId.slice(-4)}`,
      createdAt: Date.now(),
      invitees: invitees.map((inv: { userId: string; email: string; name: string }) => ({
        userId: inv.userId,
        email: inv.email,
        name: inv.name,
        status: "pending" as const,
        invitedAt: Date.now(),
      })),
    });

    console.log("[Meetings] Réunion créée avec succès", { meetingId: meeting.id, roomName: meeting.roomName });
    return NextResponse.json({ meeting }, { status: 201 });
  } catch (error) {
    console.error("[Meetings] Erreur POST /api/meetings", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create meeting" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const meetings = listMeetings();
    console.log("[Meetings] GET /api/meetings - Liste des réunions", { count: meetings.length });
    return NextResponse.json({ meetings });
  } catch (error) {
    console.error("[Meetings] Erreur GET /api/meetings", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list meetings" },
      { status: 500 }
    );
  }
}
