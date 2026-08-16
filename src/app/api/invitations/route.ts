import { NextResponse } from "next/server";
import { getClientUser } from "@/lib/procedures/client-auth";
import { listMeetings } from "@/lib/meetings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = getClientUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allMeetings = listMeetings();
    const invitations = allMeetings
      .filter((m) => m.invitees.some((i) => i.userId === user.userId && i.status === "pending"))
      .map((m) => {
        const invite = m.invitees.find((i) => i.userId === user.userId)!;
        return {
          meetingId: m.id,
          roomName: m.roomName,
          createdByName: m.createdByName,
          status: invite.status,
          invitedAt: invite.invitedAt,
        };
      });

    return NextResponse.json({ invitations });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get invitations" },
      { status: 500 }
    );
  }
}
