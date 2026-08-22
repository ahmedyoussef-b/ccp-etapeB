import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/procedures/server-auth";
import { markBootstrapDownloaded } from "@/lib/bootstrap/service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updated = await markBootstrapDownloaded(params.id, user.userId);
    if (!updated) {
      return NextResponse.json(
        { error: "Demande introuvable ou non autorisée" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Bootstrap complete error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
