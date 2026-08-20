// src/lib/procedures/auth.ts
// Pont entre l'ancien système (sessionStorage) et NextAuth.
// Les helpers de rôles/permissions vivent dans @/lib/auth/roles.
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import type { Role } from "@/lib/auth/roles";

// ====== Côté serveur (Route Handlers / Server Components) ======
export async function getServerUser(): Promise<{
  id: string;
  email: string;
  name: string;
  role: Role;
} | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

// ====== Côté client (repli sessionStorage, compatibilité) ======
export function getUserRole(): Role | null {
  if (typeof window === "undefined") return null;
  const stored = window.sessionStorage.getItem("dashboardRole");
  return (stored as Role | null) ?? null;
}

export function requireRole(allowedRoles: Role[]): void {
  const role = getUserRole();
  if (!role || !allowedRoles.includes(role)) {
    throw new Error("Forbidden");
  }
}
