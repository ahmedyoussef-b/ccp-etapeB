// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { generateCsrfToken, validateCsrfToken } from "@/lib/procedures/csrf";
import { Role, ROLE_HIERARCHY } from "@/lib/auth/roles";

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
  },
};

// ============================================
// ROUTES PUBLIQUES (pages accessibles sans auth)
// ============================================
const PUBLIC_ROUTES = ["/", "/login", "/contact"];

// Rôle minimal requis par préfixe de route (page)
const ROUTE_MIN_ROLE: Record<string, Role> = {
  "/admin": "superviseur",
  "/pipeline": "superviseur",
  "/structure-bdd": "superviseur",
  "/superviseur": "superviseur",
  "/chef-de-bloc": "chef-de-bloc",
  "/chef-de-quart": "chef-de-quart",
  "/rondier": "rondier",
};

// Page d'accueil par rôle (redirection en cas d'accès interdit)
const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  superviseur: "/admin",
  "chef-de-bloc": "/chef-de-bloc",
  "chef-de-quart": "/chef-de-quart",
  rondier: "/rondier",
};

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

// ============================================
// MIDDLEWARE PRINCIPAL
// ============================================
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  const method = request.method;
  const isProduction = process.env.NODE_ENV === "production";

  // ============================================================
  // ROUTES API — CSRF + authentification par rôle
  // (protection existante conservée, rôle lu depuis le JWT
  //  NextAuth, avec repli sur le cookie `role` legacy)
  // ============================================================
  const isProcedures = pathname.startsWith("/api/procedures");
  const isImages = pathname.startsWith("/api/images");
  const isQr = pathname.startsWith("/api/qr");
  const isMeetings = pathname.startsWith("/api/meetings");
  const isPresence = pathname.startsWith("/api/presence");

  const isProtectedRoute = isProcedures || isImages || isQr || isMeetings || isPresence;

  if (pathname.startsWith("/api")) {
    if (!isProtectedRoute) {
      // /api/auth/* (NextAuth) et autres routes API non protégées passent.
      return NextResponse.next();
    }

    // Rôle : JWT NextAuth en priorité, cookie legacy en repli.
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    const role =
      (token?.role as Role | undefined) ??
      (request.cookies.get("role")?.value as Role | undefined) ??
      null;

    // ============================================
    // RÈGLE : Méthodes non-GET — Auth + CSRF
    // ============================================
    if (method !== "GET") {
      logger.info(`[Protected] ${method} ${pathname} | role=${role ?? "none"}`);

      if (!role) {
        logger.error(`[Protected] UNAUTHORIZED - pas de rôle`);
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }

      const csrfToken =
        request.cookies.get("csrf_token")?.value ?? null;
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
    // RÈGLE : GET — Génération du token CSRF
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

  // ============================================================
  // ROUTES PAGES — Protection NextAuth
  // ============================================================
  // 1. Routes publiques → autorisées
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // 2. Vérifier la session
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    logger.warn(`[NexaFlow][Middleware] Accès non autorisé à ${pathname} → redirection login`);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role as Role;
  logger.info(`[NexaFlow][Middleware] Utilisateur: ${token.email} (${role})`);

  // 3. Vérifier le rôle requis par préfixe de route
  for (const [prefix, minRole] of Object.entries(ROUTE_MIN_ROLE)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minRole]) {
        logger.warn(`[NexaFlow][Middleware] ${role} n'a pas accès à ${pathname} → ${ROLE_HOME[role]}`);
        return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
      }
    }
  }

  // 4. Pipeline désactivé en production
  if (pathname.startsWith("/pipeline") && isProduction) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

// ============================================
// CONFIGURATION
// ============================================
export const config = {
  matcher: [
    // Pages + routes API protégées (hors assets statiques)
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
