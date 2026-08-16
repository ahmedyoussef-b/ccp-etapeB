import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateCsrfToken, validateCsrfToken } from "@/lib/procedures/csrf";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  const isProcedures = pathname.startsWith("/api/procedures");
  const isImages = pathname.startsWith("/api/images");

  if (!isProcedures && !isImages) {
    return NextResponse.next();
  }

  if (isImages && method !== "GET") {
    const role = request.cookies.get("role")?.value;
    if (!role) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (isProcedures && method !== "GET") {
    const role = request.cookies.get("role")?.value;
    if (!role) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const csrfToken = request.cookies.get("csrf_token")?.value || null;
    const csrfHeader = request.headers.get("x-csrf-token");

    if (!validateCsrfToken(csrfToken) || !validateCsrfToken(csrfHeader)) {
      return NextResponse.json({ message: "CSRF token missing or invalid" }, { status: 403 });
    }

    if (csrfToken !== csrfHeader) {
      return NextResponse.json({ message: "CSRF token mismatch" }, { status: 403 });
    }
  }

  if (method === "GET" && isProcedures) {
    const response = NextResponse.next();
    const csrfToken = generateCsrfToken();
    const cookieMaxAge = 60 * 60 * 24 * 7;
    response.cookies.set("csrf_token", csrfToken, {
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: cookieMaxAge,
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/procedures/:path*", "/api/images/:path*"],
};
