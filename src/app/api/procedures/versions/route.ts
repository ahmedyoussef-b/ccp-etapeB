import { NextResponse } from "next/server";
import { getUserFromRequest, hasRole } from "@/lib/procedures/server-auth";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["admin", "chef-de-quart"];

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!hasRole(user?.role, ALLOWED_ROLES)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    if (!code) {
      return NextResponse.json({ message: "Code is required" }, { status: 400 });
    }

    const { prisma } = await import("@/lib/prisma");
    const versions = await prisma.procedureVersion.findMany({
      where: { procedureCode: code },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        procedureCode: true,
        version: true,
        createdAt: true,
        createdBy: true,
        createdByName: true,
        comment: true,
      },
    });

    return NextResponse.json(versions);
  } catch (error) {
    console.error("Versions fetch error:", error);
    return NextResponse.json({ message: "Failed to fetch versions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!hasRole(user?.role, ALLOWED_ROLES)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { code, comment } = body;
    if (!code) {
      return NextResponse.json({ message: "Code is required" }, { status: 400 });
    }

    const { prisma } = await import("@/lib/prisma");

    const procedure = await prisma.procedure.findUnique({
      where: { code },
    });

    if (!procedure) {
      return NextResponse.json({ message: "Procedure not found" }, { status: 404 });
    }

    const latestVersion = await prisma.procedureVersion.findFirst({
      where: { procedureCode: code },
      orderBy: { createdAt: "desc" },
    });

    const currentVersion = latestVersion ? latestVersion.version : procedure.version;

    const snapshot = await prisma.procedureVersion.create({
      data: {
        procedureCode: code,
        version: currentVersion,
        body: JSON.parse(JSON.stringify(procedure.body)),
        createdBy: user?.role || null,
        createdByName: user?.role || null,
        comment: comment || null,
      },
    });

    const versionParts = procedure.version.split(".").map(Number);
    const nextVersion =
      versionParts.length >= 2 && !isNaN(versionParts[1])
        ? `${versionParts[0]}.${versionParts[1] + 1}`
        : versionParts.length === 1 && !isNaN(versionParts[0])
          ? `${versionParts[0]}.1`
          : `${procedure.version}.1`;

    await prisma.procedure.update({
      where: { id: procedure.id },
      data: { version: nextVersion },
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Version creation error:", error);
    return NextResponse.json({ message: "Failed to create version" }, { status: 500 });
  }
}
