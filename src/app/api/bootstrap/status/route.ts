import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/procedures/server-auth";
import { findActiveRequestForUser } from "@/lib/bootstrap/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const request_ = await findActiveRequestForUser(user.userId);
    return NextResponse.json({ request: request_ });
  } catch (error) {
    console.error("Bootstrap status error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
