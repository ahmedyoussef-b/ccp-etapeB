
export function getUserFromRequest(request: Request): { role: string } | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").reduce<Record<string, string>>((acc, cookie) => {
    const [name, value] = cookie.trim().split("=");
    if (name) acc[name] = decodeURIComponent(value || "");
    return acc;
  }, {});

  const role = cookies["role"];
  if (!role) return null;
  return { role };
}

export function hasRole(userRole: string | null | undefined, allowedRoles: string[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}
