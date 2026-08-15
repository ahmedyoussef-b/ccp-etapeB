import { NextResponse } from "next/server";

export function middleware(request: Request) {
  const url = new URL(request.url);
  const isDev = process.env.NODE_ENV !== 'production';

  if (!isDev && (url.pathname.startsWith('/pipeline') || url.pathname.startsWith('/api/pipeline'))) {
    const target = new URL('/', request.url);
    return NextResponse.redirect(target);
  }
}

export const config = {
  matcher: ['/pipeline/:path*', '/api/pipeline/:path*'],
};
