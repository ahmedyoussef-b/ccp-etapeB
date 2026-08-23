import { NextResponse } from "next/server";
import { getRequestUser, hasRole } from "@/lib/procedures/server-auth";
import {
  approveBootstrapRequest,
  rejectBootstrapRequest,
} from "@/lib/bootstrap/service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = getRequestUser(request);
    if (!hasRole(user?.role, ["admin"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, reviewComment } = body as {
      action?: string;
      reviewComment?: string;
    };

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    }

    const reviewer = {
      id: user!.userId,
      name: user!.email ?? "admin",
    };

    const updated =
      action === "approve"
        ? await approveBootstrapRequest(params.id, reviewer)
        : await rejectBootstrapRequest(params.id, reviewer, reviewComment);

    return NextResponse.json(updated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur serveur";
    console.error("Bootstrap review error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
