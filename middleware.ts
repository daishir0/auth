/**
 * Next.js ミドルウェア
 * - レート制限
 * - CORS設定
 * - レガシーAPI無効化
 */

import { NextRequest, NextResponse } from 'next/server';

// レート制限の設定
const RATE_LIMITS = {
  '/api/auth/login': { maxRequests: 10, windowMs: 60000 }, // 10回/分
  '/api/auth/register': { maxRequests: 5, windowMs: 3600000 }, // 5回/時
  '/oauth/token': { maxRequests: 20, windowMs: 60000 }, // 20回/分
  '/oauth/authorize': { maxRequests: 30, windowMs: 60000 }, // 30回/分
};

// インメモリのレート制限ストア（本番ではRedis推奨）
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// 許可するオリジン（環境変数から）
const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'];

// レガシーAPIのパス
const LEGACY_API_PATHS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/auth/verify',
  '/api/auth/me',
];

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(key: string, path: string): { allowed: boolean; remaining: number; resetAt: number } {
  const config = Object.entries(RATE_LIMITS).find(([pattern]) => path.includes(pattern));

  if (!config) {
    return { allowed: true, remaining: Infinity, resetAt: 0 };
  }

  const [, { maxRequests, windowMs }] = config;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

function handleCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get('origin');

  // プリフライトリクエスト
  if (request.method === 'OPTIONS') {
    const corsResponse = new NextResponse(null, { status: 204 });
    corsResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    corsResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    corsResponse.headers.set('Access-Control-Max-Age', '86400');

    if (ALLOWED_ORIGINS.includes('*')) {
      corsResponse.headers.set('Access-Control-Allow-Origin', '*');
    } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
      corsResponse.headers.set('Access-Control-Allow-Origin', origin);
      corsResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    return corsResponse;
  }

  // 通常リクエスト
  if (ALLOWED_ORIGINS.includes('*')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // レガシーAPI無効化チェック
  if (process.env.LEGACY_API_ENABLED === 'false') {
    if (LEGACY_API_PATHS.some(path => pathname === path)) {
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
        { status: 410 } // Gone
      );
    }
  }

  // CORSのプリフライトリクエスト
  if (request.method === 'OPTIONS') {
    return handleCors(request, NextResponse.next());
  }

  // レート制限
  const clientIp = getClientIp(request);
  const rateLimitKey = `${clientIp}:${pathname}`;
  const rateLimit = checkRateLimit(rateLimitKey, pathname);

  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    const response = NextResponse.json(
      {
        error: 'rate_limit_exceeded',
        message: 'Too many requests. Please try again later.',
        retry_after: retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(rateLimit.resetAt / 1000).toString(),
        },
      }
    );
    return handleCors(request, response);
  }

  // 通常のレスポンス
  const response = NextResponse.next();

  // レート制限ヘッダー
  response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
  if (rateLimit.resetAt > 0) {
    response.headers.set('X-RateLimit-Reset', Math.ceil(rateLimit.resetAt / 1000).toString());
  }

  return handleCors(request, response);
}

export const config = {
  matcher: [
    '/api/:path*',
    '/oauth/:path*',
    '/.well-known/:path*',
  ],
};
