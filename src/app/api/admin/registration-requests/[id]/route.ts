import { NextResponse } from "next/server";
import { getUserFromRequest, hasRole } from "@/lib/procedures/server-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = getUserFromRequest(request);
    if (!hasRole(user?.role, ["admin"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action, reviewComment } = body;

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Action invalide" },
        { status: 400 }
      );
    }

    const registrationRequest = await prisma.registrationRequest.findUnique({
      where: { id: params.id },
    });

    if (!registrationRequest) {
      return NextResponse.json(
        { error: "Demande introuvable" },
        { status: 404 }
      );
    }

    if (registrationRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Cette demande a déjà été traitée" },
        { status: 400 }
      );
    }

    if (action === "approve") {
      const existingUser = await prisma.user.findUnique({
        where: { email: registrationRequest.email },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "Un utilisateur avec cet email existe déjà" },
          { status: 400 }
        );
      }

      await prisma.user.create({
        data: {
          email: registrationRequest.email,
          name: registrationRequest.name,
          passwordHash: registrationRequest.passwordHash,
          role: registrationRequest.desiredRole as "admin" | "superviseur" | "chef_de_bloc" | "chef_de_quart" | "rondier",
        },
      });

      await prisma.registrationRequest.update({
        where: { id: params.id },
        data: {
          status: "approved",
          reviewedBy: user?.role || "admin",
          reviewedAt: new Date(),
          reviewComment: reviewComment || null,
        },
      });

      return NextResponse.json({ success: true, message: "Utilisateur créé avec succès" });
    }

    if (action === "reject") {
      await prisma.registrationRequest.update({
        where: { id: params.id },
        data: {
          status: "rejected",
          reviewedBy: user?.role || "admin",
          reviewedAt: new Date(),
          reviewComment: reviewComment || null,
        },
      });

      return NextResponse.json({ success: true, message: "Demande rejetée" });
    }

    return NextResponse.json({ error: "Action non supportée" }, { status: 400 });
  } catch (error) {
    console.error("Registration request action error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
