import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

interface RegisterBody {
  email: string;
  name: string;
  password: string;
  desiredRole: string;
  message?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RegisterBody;
    const { email, name, password, desiredRole, message } = body;

    if (!email || !name || !password || !desiredRole) {
      return NextResponse.json(
        { error: "Email, nom, mot de passe et rôle souhaité sont requis" },
        { status: 400 }
      );
    }

    const validRoles = ["admin", "superviseur", "chef_de_bloc", "chef_de_quart", "rondier"];
    if (!validRoles.includes(desiredRole)) {
      return NextResponse.json(
        { error: "Rôle invalide" },
        { status: 400 }
      );
    }

    const existing = await prisma.registrationRequest.findFirst({
      where: { email, status: "pending" },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Une demande est déjà en attente pour cet email" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const registrationRequest = await prisma.registrationRequest.create({
      data: {
        email,
        name,
        passwordHash,
        desiredRole,
        message: message || null,
      },
    });

    return NextResponse.json(registrationRequest, { status: 201 });
  } catch (error) {
    console.error("Registration request error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
