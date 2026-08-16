export function getClientUser(): { userId: string; role: string; email?: string } | null {
  if (typeof window === "undefined") return null;

  const cookies = document.cookie.split(";").reduce<Record<string, string>>((acc, cookie) => {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name) acc[name] = decodeURIComponent(valueParts.join("="));
    return acc;
  }, {});

  const userId = cookies["userId"];
  const role = cookies["role"];
  const email = cookies["userEmail"];

  if (!userId || !role) return null;
  return { userId, role, email };
}
