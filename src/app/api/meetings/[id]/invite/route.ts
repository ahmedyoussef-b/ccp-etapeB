import { NextResponse } from "next/server";
import { getClientUser } from "@/lib/procedures/client-auth";
import { getMeeting, addInvitee } from "@/lib/meetings";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = getClientUser();
    if (!user) {
      console.log("[Meetings] POST /api/meetings/:id/invite - Utilisateur non connecté");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const meeting = getMeeting(params.id);
    if (!meeting) {
      console.log("[Meetings] POST /api/meetings/:id/invite - Réunion introuvable", { meetingId: params.id });
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const invitees = Array.isArray(body.invitees) ? body.invitees : [];

    console.log("[Meetings] POST /api/meetings/:id/invite - Invitation(s)", { meetingId: params.id, invitedBy: user.userId, count: invitees.length, invitees });

    for (const inv of invitees) {
      addInvitee(params.id, {
        userId: inv.userId,
        email: inv.email,
        name: inv.name,
        status: "pending",
        invitedAt: Date.now(),
      });
    }

    const updated = getMeeting(params.id);
    console.log("[Meetings] Invitation(s) envoyée(s)", { meetingId: params.id, totalInvitees: updated?.invitees.length });
    return NextResponse.json({ meeting: updated });
  } catch (error) {
    console.error("[Meetings] Erreur POST /api/meetings/:id/invite", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to invite" },
      { status: 500 }
    );
  }
}
