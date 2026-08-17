import { clientEngine } from '@/lib/client-engine';

export interface ChatSession {
  id: string;
  title: string | null;
  messages: Array<{ role: string; content: string }>;
  createdAt: string;
  updatedAt: string;
}

export async function createSession(title?: string): Promise<ChatSession> {
  return clientEngine.createChatSession(title);
}

export async function getSession(id: string): Promise<ChatSession | null> {
  return clientEngine.getChatSession(id);
}

export async function updateSessionMessages(
  id: string,
  messages: Array<{ role: string; content: string }>
): Promise<ChatSession | null> {
  return clientEngine.updateChatSession(id, { messages });
}

export async function updateSessionTitle(id: string, title: string): Promise<ChatSession | null> {
  return clientEngine.updateChatSession(id, { title });
}

export async function deleteSession(id: string): Promise<boolean> {
  return clientEngine.deleteChatSession(id);
}

export async function getRecentSessions(limit = 20): Promise<ChatSession[]> {
  return clientEngine.getRecentChatSessions(limit);
}

export async function searchSessions(query: string, limit = 20): Promise<ChatSession[]> {
  return clientEngine.searchChatSessions(query, limit);
}
