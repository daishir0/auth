/**
 * Next.js Edge ミドルウェア
 * - CORS（lib/cors.ts のホワイトリスト方式）
 * - レガシーAPI無効化（410 Gone）
 *
 * レートリミットは Edge Runtime で ioredis が動かないため、
 * 各 OAuth Route 内で lib/rate-limit.ts (Node.js Runtime) を直接呼び出す形にする。
 */
import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders, isAllowedOrigin } from '@/lib/cors';

const LEGACY_API_PATHS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/auth/verify',
  '/api/auth/me',
];

function applyCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get('origin');
  if (origin && isAllowedOrigin(origin)) {
    const headers = corsHeaders(origin, {
      methods: 'GET, POST, PUT, DELETE, OPTIONS',
      headers: 'Content-Type, Authorization',
      credentials: true,
    });
    for (const [k, v] of Object.entries(headers)) {
      response.headers.set(k, v);
    }
  }
  return response;
}

function handlePreflight(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');
  const corsResponse = new NextResponse(null, { status: 204 });
  const headers = corsHeaders(origin, {
    methods: 'GET, POST, PUT, DELETE, OPTIONS',
    headers: 'Content-Type, Authorization',
    credentials: true,
  });
  for (const [k, v] of Object.entries(headers)) {
    corsResponse.headers.set(k, v);
  }
  corsResponse.headers.set('Access-Control-Max-Age', '86400');
  return corsResponse;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (process.env.LEGACY_API_ENABLED === 'false') {
    if (LEGACY_API_PATHS.some((p) => pathname === p)) {
      return NextResponse.json(
        {
          error: 'deprecated',
          message: 'This API endpoint is deprecated. Please use OAuth 2.0 endpoints.',
          oauth_endpoints: {
            authorize: '/oauth/authorize',
            token: '/oauth/token',
            userinfo: '/oauth/userinfo',
            revoke: '/oauth/revoke',
            introspect: '/oauth/introspect',
          },
        },
        { status: 410 },
      );
    }
  }

  if (request.method === 'OPTIONS') {
    return handlePreflight(request);
  }

  return applyCors(request, NextResponse.next());
}

export const config = {
  matcher: ['/api/:path*', '/oauth/:path*', '/.well-known/:path*'],
};
