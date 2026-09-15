import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, ACCESS_TOKEN_COOKIE } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/refresh'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public assets & static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/public') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.svg')
  ) {
    return NextResponse.next();
  }

  // Allow public auth API & login page
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Get JWT access token from cookie or Auth header
  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value ||
                req.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify JWT token
  const payload = await verifyAccessToken(token);
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized: Token expired or invalid' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('reason', 'idle_timeout');
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete(ACCESS_TOKEN_COOKIE);
    return res;
  }

  // Forward user context headers to API routes
  const response = NextResponse.next();
  response.headers.set('x-user-id', payload.userId);
  response.headers.set('x-user-name', payload.username);
  response.headers.set('x-user-role', payload.role);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
