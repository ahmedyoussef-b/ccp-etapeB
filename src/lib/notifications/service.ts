import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "info"
  | "bootstrap_request"
  | "bootstrap_approved"
  | "bootstrap_rejected"
  | "registration";

export interface NotificationDTO {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedId: string | null;
  read: boolean;
  createdAt: string;
}

function toDTO(n: {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedId: string | null;
  read: boolean;
  createdAt: Date;
}): NotificationDTO {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    relatedId: n.relatedId,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function createNotification(input: {
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  relatedId?: string | null;
}): Promise<NotificationDTO> {
  const n = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedId: input.relatedId ?? null,
    },
  });
  return toDTO(n);
}

export async function notifyAdmins(input: {
  type: NotificationType | string;
  title: string;
  message: string;
  relatedId?: string | null;
}): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: { id: true },
  });

  if (admins.length === 0) {
    console.warn("[Notifications] Aucun administrateur à notifier");
    return;
  }

  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedId: input.relatedId ?? null,
    })),
  });
}

export async function notifyUser(
  userId: string,
  input: {
    type: NotificationType | string;
    title: string;
    message: string;
    relatedId?: string | null;
  }
): Promise<void> {
  await createNotification({ userId, ...input });
}

export async function getNotificationsForUser(
  userId: string,
  opts: { unreadOnly?: boolean } = {}
): Promise<NotificationDTO[]> {
  const notifications = await prisma.notification.findMany({
    where: { userId, ...(opts.unreadOnly ? { read: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return notifications.map(toDTO);
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

export async function markRead(id: string, userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
}
