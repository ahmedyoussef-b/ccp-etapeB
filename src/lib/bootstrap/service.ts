import { prisma } from "@/lib/prisma";
import { signBootstrapToken } from "./token";
import {
  notifyAdmins,
  notifyUser,
} from "@/lib/notifications/service";
import type { BootstrapStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

type BootstrapRequestWithUser = Prisma.BootstrapRequestGetPayload<{
  include: { user: true };
}>;

export interface BootstrapRequestDTO {
  id: string;
  userId: string;
  status: BootstrapStatus;
  requestedAt: string;
  approvedAt: string | null;
  downloadedAt: string | null;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewComment: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

function toDTO(req: BootstrapRequestWithUser): BootstrapRequestDTO {
  return {
    id: req.id,
    userId: req.userId,
    status: req.status,
    requestedAt: req.requestedAt.toISOString(),
    approvedAt: req.approvedAt ? req.approvedAt.toISOString() : null,
    downloadedAt: req.downloadedAt ? req.downloadedAt.toISOString() : null,
    reviewedById: req.reviewedById,
    reviewedByName: req.reviewedByName,
    reviewComment: req.reviewComment,
    user: req.user
      ? { id: req.user.id, name: req.user.name, email: req.user.email }
      : undefined,
  };
}

export async function findActiveRequestForUser(
  userId: string
): Promise<BootstrapRequestDTO | null> {
  const req = await prisma.bootstrapRequest.findFirst({
    where: { userId, status: { in: ["pending", "approved"] } },
    orderBy: { requestedAt: "desc" },
    include: { user: true },
  });
  return req ? toDTO(req) : null;
}

export async function createBootstrapRequest(
  userId: string
): Promise<BootstrapRequestDTO> {
  const existing = await findActiveRequestForUser(userId);
  if (existing) return existing;

  const req = await prisma.bootstrapRequest.create({
    data: { userId },
    include: { user: true },
  });
  return toDTO(req);
}

export async function listBootstrapRequests(
  status?: BootstrapStatus
): Promise<BootstrapRequestDTO[]> {
  const requests = await prisma.bootstrapRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { requestedAt: "desc" },
    include: { user: true },
  });
  return requests.map(toDTO);
}

export async function getBootstrapRequestById(
  id: string
): Promise<BootstrapRequestDTO | null> {
  const req = await prisma.bootstrapRequest.findUnique({
    where: { id },
    include: { user: true },
  });
  return req ? toDTO(req) : null;
}

export async function approveBootstrapRequest(
  id: string,
  reviewer: { id: string; name: string }
): Promise<BootstrapRequestDTO> {
  const existing = await prisma.bootstrapRequest.findUnique({ where: { id } });
  if (!existing) throw new Error("Demande de bootstrap introuvable");
  if (existing.status !== "pending") {
    throw new Error("Cette demande a déjà été traitée");
  }

  const token = await signBootstrapToken({
    requestId: id,
    userId: existing.userId,
  });

  const req = await prisma.bootstrapRequest.update({
    where: { id },
    data: {
      status: "approved",
      approvedAt: new Date(),
      token,
      reviewedById: reviewer.id,
      reviewedByName: reviewer.name,
    },
    include: { user: true },
  });

  await notifyUserOfBootstrapDecision(req);
  return toDTO(req);
}

export async function rejectBootstrapRequest(
  id: string,
  reviewer: { id: string; name: string },
  comment?: string
): Promise<BootstrapRequestDTO> {
  const existing = await prisma.bootstrapRequest.findUnique({ where: { id } });
  if (!existing) throw new Error("Demande de bootstrap introuvable");
  if (existing.status !== "pending") {
    throw new Error("Cette demande a déjà été traitée");
  }

  const req = await prisma.bootstrapRequest.update({
    where: { id },
    data: {
      status: "rejected",
      approvedAt: new Date(),
      reviewedById: reviewer.id,
      reviewedByName: reviewer.name,
      reviewComment: comment ?? null,
    },
    include: { user: true },
  });

  await notifyUserOfBootstrapDecision(req);
  return toDTO(req);
}

export async function markBootstrapDownloaded(
  id: string,
  userId: string
): Promise<BootstrapRequestDTO | null> {
  const existing = await prisma.bootstrapRequest.findUnique({ where: { id } });
  if (!existing) return null;
  if (existing.userId !== userId) return null;
  if (existing.status !== "approved") return null;

  const req = await prisma.bootstrapRequest.update({
    where: { id },
    data: { status: "downloaded", downloadedAt: new Date() },
    include: { user: true },
  });
  return toDTO(req);
}

async function notifyUserOfBootstrapDecision(
  req: BootstrapRequestWithUser
): Promise<void> {
  const action = req.status === "approved" ? "approuvée" : "rejetée";
  const message = `Votre demande d'initialisation de la BDD locale a été ${action}.`;
  if (req.userId) {
    await notifyUser(req.userId, {
      type: req.status === "approved" ? "bootstrap_approved" : "bootstrap_rejected",
      title: `Bootstrap BDD ${action}`,
      message,
      relatedId: req.id,
    });
  }
}

export async function notifyAdminsOfBootstrapRequest(
  req: BootstrapRequestDTO
): Promise<void> {
  const who = req.user?.email ?? req.userId;
  await notifyAdmins({
    type: "bootstrap_request",
    title: "Nouvelle demande de bootstrap BDD",
    message: `L'utilisateur ${who} demande l'initialisation de sa BDD locale.`,
    relatedId: req.id,
  });
}
