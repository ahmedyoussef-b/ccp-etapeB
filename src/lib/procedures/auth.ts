export function getUserRole(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("dashboardRole");
}

export function requireRole(allowedRoles: string[]): void {
  const role = getUserRole();
  if (!role || !allowedRoles.includes(role)) {
    throw new Error("Forbidden");
  }
}
