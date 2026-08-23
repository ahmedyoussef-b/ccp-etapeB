export function getUserFromRequest(request: Request): { userId: string; email?: string; role: string } | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").reduce<Record<string, string>>((acc, cookie) => {
    const [name, value] = cookie.trim().split("=");
    if (name) acc[name] = decodeURIComponent(value || "");
    return acc;
  }, {});

  const role = cookies["role"];
  const userId = cookies["userId"];
  const email = cookies["email"];
  if (!userId || !role) return null;
  return { userId, email, role };
}

export const getRequestUser = getUserFromRequest;

export function hasRole(userRole: string | null | undefined, allowedRoles: string[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}
