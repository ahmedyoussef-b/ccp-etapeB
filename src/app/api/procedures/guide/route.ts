import { NextResponse } from "next/server";
import { offlineRepo } from "@/lib/procedures/offline-repo";
import { getUserFromRequest, hasRole } from "@/lib/procedures/server-auth";
import { generateUUID } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

const ADMIN_AND_CHEF = ["admin", "chef-de-quart"];

export async function GET() {
  try {
    const { prisma } = await import("@/lib/prisma");
    const procedures = await prisma.procedure.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(procedures);
  } catch {
    const procedures = await offlineRepo.getAll();
    return NextResponse.json(procedures);
  }
}

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!hasRole(user?.role, ADMIN_AND_CHEF)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    try {
      const { prisma } = await import("@/lib/prisma");
      const created = await prisma.procedure.create({
        data: {
          uuid: generateUUID(),
          code: body.metadata?.code || body.code,
          title: body.metadata?.title || body.title,
          description: body.metadata?.description || body.description,
          category: body.metadata?.category || body.category,
          priority: body.metadata?.priority || body.priority || "moyenne",
          estimatedTimeMinutes: body.metadata?.estimatedTimeMinutes || body.estimatedTimeMinutes || 1,
          requiredRoles: {
            create: (body.metadata?.requiredRoles || body.requiredRoles || []).map((role: string) => ({
              uuid: generateUUID(),
              role,
            })),
          },
          globalSafetyInstructions: {
            create: (body.metadata?.globalSafetyInstructions || body.globalSafetyInstructions || []).map((instr: string) => ({
              uuid: generateUUID(),
              instruction: instr,
            })),
          },
          status: body.metadata?.status || body.status || "draft",
          authorId: body.metadata?.authorId || body.authorId,
          authorName: body.metadata?.authorName || body.authorName,
          approverId: body.metadata?.approverId || body.approverId,
          approverName: body.metadata?.approverName || body.approverName,
          version: body.metadata?.version || body.version || "1.0",
          tags: {
            create: (body.metadata?.tags || body.tags || []).map((tag: string) => ({
              uuid: generateUUID(),
              tag,
            })),
          },
          language: body.metadata?.language || body.language || "fr-FR",
          body: body.metadata?.body || body.body || {},
        },
      });
      return NextResponse.json(created, { status: 201 });
    } catch {
      await offlineRepo.save(body);
      return NextResponse.json({ success: true }, { status: 201 });
    }
  } catch {
    return NextResponse.json({ success: false, message: "Invalid procedure" }, { status: 400 });
  }
}
