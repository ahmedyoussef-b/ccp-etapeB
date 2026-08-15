import { NextResponse } from "next/server";

export function middleware(request: Request) {
  const url = new URL(request.url);
  const isDev = process.env.NODE_ENV !== 'production';

  if (!isDev && (url.pathname.startsWith('/pipeline') || url.pathname.startsWith('/api/pipeline'))) {
    return NextResponse.redirect(new URL('/', request.url));
  }
}

export const config = {
  matcher: ['/pipeline/:path*', '/api/pipeline/:path*'],
};
