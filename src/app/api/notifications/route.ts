import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/procedures/server-auth";
import {
  getNotificationsForUser,
  getUnreadCount,
  markAllRead,
} from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const unreadOnly = new URL(request.url).searchParams.get("unread") === "1";
    const notifications = await getNotificationsForUser(user.userId, { unreadOnly });
    const unreadCount = await getUnreadCount(user.userId);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Notifications GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.id) {
      const { markRead } = await import("@/lib/notifications/service");
      await markRead(body.id, user.userId);
    } else {
      await markAllRead(user.userId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notifications POST error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
