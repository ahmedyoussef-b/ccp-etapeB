import { NextResponse } from "next/server";
import { getUserFromRequest, hasRole } from "@/lib/procedures/server-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!hasRole(user?.role, ["admin"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requests = await prisma.registrationRequest.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Registration requests fetch error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
