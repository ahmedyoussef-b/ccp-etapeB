// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateCsrfToken, validateCsrfToken } from "@/lib/procedures/csrf";

// ============================================
// TYPES
// ============================================
type LogData = string | number | boolean | null | undefined | Record<string, unknown>;

// ============================================
// LOGGER STRUCTURÉ
// ============================================
const logger = {
  info: (msg: string, data?: LogData) => {
    console.log(`[Middleware] ℹ️ ${msg}`, data ?? '');
  },
  success: (msg: string, data?: LogData) => {
    console.log(`[Middleware] ✅ ${msg}`, data ?? '');
  },
  warn: (msg: string, data?: LogData) => {
    console.log(`[Middleware] ⚠️ ${msg}`, data ?? '');
  },
  error: (msg: string, data?: LogData) => {
    console.log(`[Middleware] ❌ ${msg}`, data ?? '');
  }
};

// ============================================
// MIDDLEWARE PRINCIPAL
// ============================================
export function middleware(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;
  const method = request.method;
  const isProduction = process.env.NODE_ENV === 'production';

  // ============================================
  // RÈGLE 1 : Pipeline - Bloquer en production
  // ============================================
  if (pathname.startsWith("/api/pipeline") || pathname.startsWith("/pipeline")) {
    if (isProduction) {
      logger.warn(`Pipeline bloqué en production: ${method} ${pathname}`);
      // Rediriger vers la page d'accueil
      if (pathname.startsWith("/pipeline")) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.json(
        { error: "Pipeline non disponible en production" },
        { status: 403 }
      );
    }
    
    // En développement, autoriser avec log
    logger.info(`Pipeline autorisé en développement: ${method} ${pathname}`);
    return NextResponse.next();
  }

  // ============================================
  // RÈGLE 2 : Routes protégées par CSRF
  // ============================================
  const isProcedures = pathname.startsWith("/api/procedures");
  const isImages = pathname.startsWith("/api/images");
  const isQr = pathname.startsWith("/api/qr");
  const isMeetings = pathname.startsWith("/api/meetings");
  const isPresence = pathname.startsWith("/api/presence");

  const isProtectedRoute = isProcedures || isImages || isQr || isMeetings || isPresence;

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // ============================================
  // RÈGLE 3 : Images - Auth par rôle
  // ============================================
  if (isImages && method !== "GET") {
    const role = request.cookies.get("role")?.value;
    logger.info(`[Images] ${method} ${pathname} | role=${role ?? "none"}`);
    
    if (!role) {
      logger.error(`[Images] UNAUTHORIZED - pas de rôle`);
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    
    logger.success(`[Images] Autorisation OK - role=${role}`);
    return NextResponse.next();
  }

  // ============================================
  // RÈGLE 4 : Procédures, QR, Réunions - Auth + CSRF
  // ============================================
  if (method !== "GET") {
    const role = request.cookies.get("role")?.value;
    logger.info(`[Protected] ${method} ${pathname} | role=${role ?? "none"}`);
    
    if (!role) {
      logger.error(`[Protected] UNAUTHORIZED - pas de rôle`);
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Vérification CSRF pour les méthodes non-GET
    const csrfToken = request.cookies.get("csrf_token")?.value ?? null;
    const csrfHeader = request.headers.get("x-csrf-token");

    logger.info(`[Protected] CSRF: cookie=${!!csrfToken}, header=${!!csrfHeader}`);

    if (!validateCsrfToken(csrfToken) || !validateCsrfToken(csrfHeader)) {
      logger.error(`[Protected] CSRF validation échouée`);
      return NextResponse.json(
        { message: "CSRF token missing or invalid" },
        { status: 403 }
      );
    }

    if (csrfToken !== csrfHeader) {
      logger.error(`[Protected] CSRF token mismatch`);
      return NextResponse.json(
        { message: "CSRF token mismatch" },
        { status: 403 }
      );
    }

    logger.success(`[Protected] Autorisation + CSRF OK - role=${role}`);
  }

  // ============================================
  // RÈGLE 5 : GET - Génération du token CSRF
  // ============================================
  if (method === "GET") {
    logger.info(`[GET] ${pathname} - Génération du token CSRF`);
    const response = NextResponse.next();
    const csrfToken = generateCsrfToken();
    const cookieMaxAge = 60 * 60 * 24 * 7; // 7 jours
    
    response.cookies.set("csrf_token", csrfToken, {
      path: "/",
      secure: isProduction,
      sameSite: "strict",
      maxAge: cookieMaxAge,
    });
    
    return response;
  }

  logger.success(`${method} ${pathname} -> AUTORISÉ`);
  return NextResponse.next();
}

// ============================================
// CONFIGURATION
// ============================================
export const config = {
  matcher: [
    // Routes protégées par le middleware
    "/api/procedures/:path*",
    "/api/images/:path*",
    "/api/qr/:path*",
    "/api/meetings/:path*",
    "/api/presence/:path*",
    "/api/pipeline/:path*",
    "/pipeline/:path*",
  ],
};