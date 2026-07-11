import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PATHS = ['/dashboard', '/pipelines', '/quality'];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Forward API + auth calls to the backend. BACKEND_URL is read here at
  // request time (not in next.config rewrites, which are frozen into the
  // build), so the same container image works locally and on Cloud Run.
  if (pathname.startsWith('/api/') || pathname.startsWith('/auth/')) {
    const backend = process.env.BACKEND_URL || 'http://localhost:8000';
    return NextResponse.rewrite(new URL(`${pathname}${search}`, backend));
  }

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const token = request.cookies.get('access_token');

  if (isProtected && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Send logged-in users from the auth pages straight to the app
  if (token && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/auth/:path*',
    '/dashboard/:path*',
    '/pipelines/:path*',
    '/quality/:path*',
    '/login',
    '/signup',
  ],
};
