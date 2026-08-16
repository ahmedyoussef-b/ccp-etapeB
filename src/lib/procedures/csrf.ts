const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_LENGTH = 32;

function generateRandomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values).map((v) => chars[v % chars.length]).join("");
}

export function generateCsrfToken(): string {
  return generateRandomString(CSRF_TOKEN_LENGTH);
}

export function getCsrfTokenFromCookies(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";").reduce<Record<string, string>>((acc, cookie) => {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name) acc[name] = decodeURIComponent(valueParts.join("="));
    return acc;
  }, {});
  return cookies[CSRF_COOKIE_NAME] || null;
}

export function getCsrfHeaderName(): string {
  return CSRF_HEADER_NAME;
}

export function validateCsrfToken(token: string | null): boolean {
  if (!token) return false;
  return token.length === CSRF_TOKEN_LENGTH;
}
