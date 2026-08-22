import { NextResponse } from "next/server";
import { getRequestUser, hasRole } from "@/lib/procedures/server-auth";
import { listBootstrapRequests } from "@/lib/bootstrap/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = getRequestUser(request);
    if (!hasRole(user?.role, ["admin"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requests = await listBootstrapRequests();
    return NextResponse.json(requests);
  } catch (error) {
    console.error("Bootstrap list error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
