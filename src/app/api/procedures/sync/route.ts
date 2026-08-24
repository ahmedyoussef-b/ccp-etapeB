import { NextResponse } from "next/server";
import { offlineRepo } from "@/lib/procedures/offline-repo";
import { getUserFromRequest, hasRole } from "@/lib/procedures/server-auth";
import { ProcedureSchema } from "@/lib/procedures/services/validator.service";
import { generateUUID } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["admin", "chef-de-quart"];

function bumpVersion(version: string): string {
  const parts = version.split(".").map(Number);
  if (parts.length >= 2 && !isNaN(parts[1])) {
    return `${parts[0]}.${parts[1] + 1}`;
  }
  if (parts.length === 1 && !isNaN(parts[0])) {
    return `${parts[0]}.1`;
  }
  return `${version}.1`;
}

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!hasRole(user?.role, ALLOWED_ROLES)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = ProcedureSchema.parse(body);

    try {
      const { prisma } = await import("@/lib/prisma");
      const existing = await prisma.procedure.findUnique({
        where: { code: validated.metadata.code },
      });

      let newVersion = validated.metadata.version || "1.0";
      if (existing) {
        const currentBodyStr = JSON.stringify(existing.body);
        const newBodyStr = JSON.stringify(validated);
        if (currentBodyStr !== newBodyStr) {
          newVersion = bumpVersion(existing.version);
        } else {
          newVersion = existing.version;
        }
      }

      const requiredRolesData = (validated.metadata.requiredRoles || []).map((role: string) => ({
        uuid: generateUUID(),
        role,
      }));
      const safetyInstructionsData = (validated.metadata.globalSafetyInstructions || []).map((instr: string) => ({
        uuid: generateUUID(),
        instruction: instr,
      }));

      const saved = await prisma.procedure.upsert({
        where: { code: validated.metadata.code },
        create: {
          uuid: generateUUID(),
          code: validated.metadata.code,
          title: validated.metadata.title,
          description: validated.metadata.description || "",
          category: validated.metadata.category,
          priority: validated.metadata.priority,
          estimatedTimeMinutes: validated.metadata.estimatedTimeMinutes,
          requiredRoles: { create: requiredRolesData },
          globalSafetyInstructions: { create: safetyInstructionsData },
          body: validated,
          version: newVersion,
        },
        update: {
          title: validated.metadata.title,
          description: validated.metadata.description || "",
          category: validated.metadata.category,
          priority: validated.metadata.priority,
          estimatedTimeMinutes: validated.metadata.estimatedTimeMinutes,
          body: validated,
          version: newVersion,
          updatedAt: new Date(),
        },
      });

      // Sync relation tables for existing procedures
      if (existing) {
        await prisma.procedureRequiredRole.deleteMany({ where: { procedureId: saved.id } });
        if (requiredRolesData.length > 0) {
          await prisma.procedureRequiredRole.createMany({
            data: requiredRolesData.map((r) => ({ ...r, procedureId: saved.id })),
          });
        }

        await prisma.procedureSafetyInstruction.deleteMany({ where: { procedureId: saved.id } });
        if (safetyInstructionsData.length > 0) {
          await prisma.procedureSafetyInstruction.createMany({
            data: safetyInstructionsData.map((s) => ({ ...s, procedureId: saved.id })),
          });
        }
      }
      return NextResponse.json(saved);
    } catch {
      await offlineRepo.save(validated);
      return NextResponse.json({ success: true, offline: true });
    }
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { message: "Invalid procedure or sync failed" },
      { status: 400 }
    );
  }
}
