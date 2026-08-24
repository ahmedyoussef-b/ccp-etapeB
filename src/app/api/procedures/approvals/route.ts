import { NextResponse } from "next/server";
import { prisma, generateUUID } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const approvals = await prisma.approval.findMany({
      include: {
        procedure: {
          select: {
            code: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(approvals);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, action, approverId, approverName, approverRole, comment } = body;

    if (!code || !action || !approverId || !approverName || !approverRole) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    const procedure = await prisma.procedure.findFirst({ where: { code } });
    if (!procedure) {
      return NextResponse.json({ error: "Procédure introuvable" }, { status: 404 });
    }

    if (action === "submit") {
      const updated = await prisma.procedure.update({
        where: { id: procedure.id },
        data: { status: "submitted" },
      });
      return NextResponse.json(updated);
    }

    if (action === "approve") {
      const updated = await prisma.procedure.update({
        where: { id: procedure.id },
        data: {
          status: "approved",
          approverId,
          approverName,
          reviewDate: new Date(),
        },
      });
      await prisma.approval.create({
        data: {
          uuid: generateUUID(),
          procedureId: procedure.id,
          approverId,
          approverName,
          approverRole,
          status: "approved",
          comment: comment || "",
        },
      });
      return NextResponse.json(updated);
    }

    if (action === "reject") {
      const updated = await prisma.procedure.update({
        where: { id: procedure.id },
        data: { status: "rejected" },
      });
      await prisma.approval.create({
        data: {
          uuid: generateUUID(),
          procedureId: procedure.id,
          approverId,
          approverName,
          approverRole,
          status: "rejected",
          comment: comment || "",
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Action non supportée" }, { status: 400 });
  } catch (error) {
    console.error("Approval error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
