//src/lib/procedures/csrf-fetch.ts
import { getCsrfTokenFromCookies, getCsrfHeaderName } from "./csrf";

export async function csrfFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const csrfToken = getCsrfTokenFromCookies();
  const headers = new Headers(options.headers);

  if (csrfToken) {
    headers.set(getCsrfHeaderName(), csrfToken);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
