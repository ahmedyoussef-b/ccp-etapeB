import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/procedures/server-auth";
import {
  createBootstrapRequest,
  notifyAdminsOfBootstrapRequest,
} from "@/lib/bootstrap/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await createBootstrapRequest(user.userId);

    if (existing.status === "pending") {
      await notifyAdminsOfBootstrapRequest(existing);
    }

    return NextResponse.json(existing, { status: 201 });
  } catch (error) {
    console.error("Bootstrap request error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
