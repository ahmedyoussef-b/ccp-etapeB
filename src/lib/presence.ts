export type OnlineUser = {
  userId: string;
  email: string;
  role: string;
  name: string;
  lastSeen: number;
};

const presence: Record<string, OnlineUser> = {};

const HEARTBEAT_TTL_MS = 60_000;

export function registerPresence(user: OnlineUser): void {
  presence[user.userId] = { ...user, lastSeen: Date.now() };
}

export function updatePresenceHeartbeat(userId: string): void {
  const existing = presence[userId];
  if (existing) {
    existing.lastSeen = Date.now();
  }
}

export function removePresence(userId: string): void {
  delete presence[userId];
}

export function getOnlineUsers(): OnlineUser[] {
  const now = Date.now();
  const users: OnlineUser[] = [];
  for (const userId in presence) {
    if (Object.prototype.hasOwnProperty.call(presence, userId)) {
      const user = presence[userId];
      if (now - user.lastSeen > HEARTBEAT_TTL_MS) {
        delete presence[userId];
      } else {
        users.push(user);
      }
    }
  }
  return users.sort((a, b) => a.name.localeCompare(b.name));
}

export function getOnlineUser(userId: string): OnlineUser | undefined {
  return presence[userId];
}
