import { NextResponse } from "next/server";
import { offlineRepo } from "@/lib/procedures/offline-repo";
import { getUserFromRequest, hasRole } from "@/lib/procedures/server-auth";

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const procedure = await prisma.procedure.findUnique({
      where: { code: params.id },
      include: { requiredRoles: true },
    });

    if (!procedure) {
      return NextResponse.json({ message: "Procedure not found" }, { status: 404 });
    }

    const user = getUserFromRequest(request);
    const requiredRoles = procedure.requiredRoles.map((r) => r.role) || [];
    const isAdmin = hasRole(user?.role, ["admin"]);
    const hasRequiredRole = isAdmin || hasRole(user?.role, requiredRoles);

    if (!hasRequiredRole) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(procedure);
  } catch {
    const procedure = await offlineRepo.getById(params.id);
    if (!procedure) {
      return NextResponse.json({ message: "Procedure not found" }, { status: 404 });
    }

    const user = getUserFromRequest(request);
    const requiredRoles = procedure.metadata?.requiredRoles || [];
    const isAdmin = hasRole(user?.role, ["admin"]);
    const hasRequiredRole = isAdmin || hasRole(user?.role, requiredRoles);

    if (!hasRequiredRole) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(procedure);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const procedure = await prisma.procedure.findUnique({
      where: { code: params.id },
    });

    if (!procedure) {
      return NextResponse.json({ message: "Procedure not found" }, { status: 404 });
    }

    const user = getUserFromRequest(request);
    const isAdmin = hasRole(user?.role, ["admin"]);
    const isAuthor = procedure.authorId && user?.role ? procedure.authorId === user.role : false;

    if (!isAdmin && !isAuthor) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    await prisma.procedure.update({
      where: { code: params.id },
      data: { deletedAt: new Date(), syncStatus: "pending" },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    await offlineRepo.delete(params.id);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
