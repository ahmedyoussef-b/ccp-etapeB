import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateCsrfToken, validateCsrfToken } from "@/lib/procedures/csrf";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  const isProcedures = pathname.startsWith("/api/procedures");
  const isImages = pathname.startsWith("/api/images");

  console.log(`[Middleware] ${method} ${pathname} | images=${isImages} procedures=${isProcedures}`);

  if (!isProcedures && !isImages) {
    return NextResponse.next();
  }

  if (isImages && method !== "GET") {
    const role = request.cookies.get("role")?.value;
    console.log(`[Middleware][Images] ${method} ${pathname} | role=${role || "none"}`);
    if (!role) {
      console.log(`[Middleware][Images] UNAUTHORIZED - no role cookie`);
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    console.log(`[Middleware][Images] Authorized - role=${role}`);
    return NextResponse.next();
  }

  if (isProcedures && method !== "GET") {
    const role = request.cookies.get("role")?.value;
    console.log(`[Middleware][Procedures] ${method} ${pathname} | role=${role || "none"}`);
    if (!role) {
      console.log(`[Middleware][Procedures] UNAUTHORIZED - no role cookie`);
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const csrfToken = request.cookies.get("csrf_token")?.value || null;
    const csrfHeader = request.headers.get("x-csrf-token");

    console.log(`[Middleware][Procedures] CSRF token present=${!!csrfToken}, header present=${!!csrfHeader}, match=${csrfToken === csrfHeader}`);

    if (!validateCsrfToken(csrfToken) || !validateCsrfToken(csrfHeader)) {
      console.log(`[Middleware][Procedures] CSRF validation failed`);
      return NextResponse.json({ message: "CSRF token missing or invalid" }, { status: 403 });
    }

    if (csrfToken !== csrfHeader) {
      console.log(`[Middleware][Procedures] CSRF token mismatch`);
      return NextResponse.json({ message: "CSRF token mismatch" }, { status: 403 });
    }
  }

  if (method === "GET" && isProcedures) {
    console.log(`[Middleware][Procedures] GET request - generating CSRF token`);
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

  console.log(`[Middleware] ${method} ${pathname} -> ALLOWED`);
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/procedures/:path*", "/api/images/:path*"],
};
