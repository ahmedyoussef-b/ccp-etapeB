import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface ChatSession {
  id: string;
  title: string | null;
  messages: Array<{ role: string; content: string }>;
  createdAt: string;
  updatedAt: string;
}

export async function createSession(title?: string): Promise<ChatSession> {
  const session = await prisma.chatSession.create({
    data: {
      title: title || null,
      messages: [],
    },
  });

  return {
    id: session.id,
    title: session.title,
    messages: session.messages as Array<{ role: string; content: string }>,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export async function getSession(id: string): Promise<ChatSession | null> {
  const session = await prisma.chatSession.findUnique({
    where: { id },
  });

  if (!session) return null;

  return {
    id: session.id,
    title: session.title,
    messages: session.messages as Array<{ role: string; content: string }>,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export async function updateSessionMessages(
  id: string,
  messages: Array<{ role: string; content: string }>
): Promise<ChatSession | null> {
  const session = await prisma.chatSession.update({
    where: { id },
    data: {
      messages,
      updatedAt: new Date(),
    },
  });

  return {
    id: session.id,
    title: session.title,
    messages: session.messages as Array<{ role: string; content: string }>,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export async function updateSessionTitle(id: string, title: string): Promise<ChatSession | null> {
  const session = await prisma.chatSession.update({
    where: { id },
    data: { title, updatedAt: new Date() },
  });

  return {
    id: session.id,
    title: session.title,
    messages: session.messages as Array<{ role: string; content: string }>,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export async function deleteSession(id: string): Promise<boolean> {
  try {
    await prisma.chatSession.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function getRecentSessions(limit = 20): Promise<ChatSession[]> {
  const sessions = await prisma.chatSession.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    messages: s.messages as Array<{ role: string; content: string }>,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
}

export async function searchSessions(query: string, limit = 20): Promise<ChatSession[]> {
  const sessions = await prisma.chatSession.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { messages: { path: ["content"], array_contains: query } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    messages: s.messages as Array<{ role: string; content: string }>,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
}
