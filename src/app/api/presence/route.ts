import { NextResponse } from "next/server";
import { getClientUser } from "@/lib/procedures/client-auth";
import { registerPresence, getOnlineUsers } from "@/lib/presence";

export const dynamic = "force-dynamic";

function getUserNameFromEmail(email: string): string {
  const lower = email.toLowerCase();
  if (lower.includes("admin")) return "Admin User";
  const match = email.match(/^([^@]+)@/);
  if (match) {
    const name = match[1].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return name || email;
  }
  return email;
}

export async function POST(request: Request) {
  try {
    const user = getClientUser();
    if (!user) {
      console.log("[Presence] POST /api/presence - Utilisateur non connecté");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email : "";

    console.log("[Presence] POST /api/presence - Heartbeat reçu", { userId: user.userId, role: user.role, email });

    registerPresence({
      userId: user.userId,
      email: email || `${user.userId}@nexaflow.local`,
      role: user.role,
      name: getUserNameFromEmail(email || user.userId),
      lastSeen: Date.now(),
    });

    const onlineCount = getOnlineUsers().length;
    console.log("[Presence] Utilisateur enregistré", { userId: user.userId, onlineCount });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Presence] Erreur POST /api/presence", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to register presence" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const users = getOnlineUsers();
    console.log("[Presence] GET /api/presence - Liste des utilisateurs en ligne", { count: users.length, users });
    return NextResponse.json({ users });
  } catch (error) {
    console.error("[Presence] Erreur GET /api/presence", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get online users" },
      { status: 500 }
    );
  }
}
