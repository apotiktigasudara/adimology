import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from './lib/auth';

const SESSION_NAME = 'adimology_session';

// Define paths that don't require authentication
const PUBLIC_PATHS = [
  '/api/auth/verify-password',
  '/api/auth/check-password',
  '/api/auth/set-password', // Allow initial setup
  // Phoenix Bot data feeds — read-only, no auth needed
  '/api/bandar-alerts',
  '/api/bandar-flow',
  '/api/triggers',
  '/api/sm-analysis',
  '/api/confluence',
  '/api/sector-heatmap',
  '/api/alert-center',
  '/api/backtest',
  '/api/analyze-story-background',
  // Chrome extension token sync — no session cookie, must be public
  '/api/update-token',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age':       '86400',
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow CORS preflight — return headers directly so Vercel edge doesn't strip them
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
  }

  // 1. Allow background jobs/cron via secret token
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return NextResponse.next();
  }

  // 2. Only protect API routes
  if (!pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Allow public auth routes
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get(SESSION_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: No session' },
      { status: 401 }
    );
  }

  // Verify token
  const session = await verifySessionToken(sessionCookie);
  if (!session) {
    // Session invalid or expired
    const response = NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid session' },
      { status: 401 }
    );
    
    // Clear the invalid cookie
    response.cookies.delete(SESSION_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
