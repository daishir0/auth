/**
 * OAuth 2.0 認可エンドポイント
 * RFC 6749: The OAuth 2.0 Authorization Framework
 * Authorization Code Flow を実装
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateAuthorizationCode, getAuthCodeExpiry, verifyAccessToken, verifyLegacyAccessToken } from '@/lib/oauth-auth';
import { cookies } from 'next/headers';

interface AuthorizeParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope?: string;
  state?: string;
  nonce?: string;
  code_challenge?: string;
  code_challenge_method?: 'S256' | 'plain';
}

/**
 * プロキシ背後でも正しいベースURLを取得する
 * X-Forwarded-* ヘッダーを参照
 */
function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3019';
  return `${proto}://${host}`;
}

function validateParams(params: URLSearchParams): AuthorizeParams | { error: string; error_description: string } {
  const response_type = params.get('response_type');
  const client_id = params.get('client_id');
  const redirect_uri = params.get('redirect_uri');

  if (!response_type) {
    return { error: 'invalid_request', error_description: 'response_type is required' };
  }

  if (response_type !== 'code') {
    return { error: 'unsupported_response_type', error_description: 'Only "code" response_type is supported' };
  }

  if (!client_id) {
    return { error: 'invalid_request', error_description: 'client_id is required' };
  }

  if (!redirect_uri) {
    return { error: 'invalid_request', error_description: 'redirect_uri is required' };
  }

  return {
    response_type,
    client_id,
    redirect_uri,
    scope: params.get('scope') || 'openid',
    state: params.get('state') || undefined,
    nonce: params.get('nonce') || undefined,
    code_challenge: params.get('code_challenge') || undefined,
    code_challenge_method: (params.get('code_challenge_method') as 'S256' | 'plain') || 'S256',
  };
}

async function getCurrentUser(request: NextRequest): Promise<{ userId: string; email: string; roles: string[] } | null> {
  // クッキーからトークンを取得
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  // または Authorization ヘッダー
  const authHeader = request.headers.get('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const token = accessToken || bearerToken;
  if (!token) return null;

  // RS256トークンを試行
  let payload = await verifyAccessToken(token);

  // 失敗したらHS256（レガシー）を試行
  if (!payload) {
    payload = await verifyLegacyAccessToken(token);
  }

  if (!payload) return null;

  // ユーザーがアクティブか確認
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { isActive: true },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return payload;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paramsOrError = validateParams(searchParams);

  if ('error' in paramsOrError) {
    // redirect_uriがある場合はリダイレクト
    const redirect_uri = searchParams.get('redirect_uri');
    const state = searchParams.get('state');
    if (redirect_uri) {
      const errorUrl = new URL(redirect_uri);
      errorUrl.searchParams.set('error', paramsOrError.error);
      errorUrl.searchParams.set('error_description', paramsOrError.error_description);
      if (state) errorUrl.searchParams.set('state', state);
      return NextResponse.redirect(errorUrl.toString());
    }
    return NextResponse.json(paramsOrError, { status: 400 });
  }

  const params = paramsOrError;

  // クライアントを検証
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: params.client_id },
  });

  if (!client || !client.isActive) {
    return buildErrorResponse(params.redirect_uri, 'invalid_client', 'Client not found or inactive', params.state);
  }

  // redirect_uriを検証（配列形式）
  if (!client.redirectUris.includes(params.redirect_uri)) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Invalid redirect_uri' },
      { status: 400 }
    );
  }

  // スコープを検証（配列形式）
  const requestedScopes = params.scope?.split(' ') || ['openid'];
  const allowedScopes = [...client.scopes, 'openid', 'profile', 'email', 'offline_access', 'custom'];
  const invalidScopes = requestedScopes.filter(s => !allowedScopes.includes(s));
  if (invalidScopes.length > 0) {
    return buildErrorResponse(params.redirect_uri, 'invalid_scope', `Invalid scope: ${invalidScopes.join(', ')}`, params.state);
  }

  // ユーザー認証をチェック
  const user = await getCurrentUser(request);

  if (!user) {
    // 未認証の場合、ログインページにリダイレクト
    const baseUrl = getBaseUrl(request);
    const loginUrl = new URL('/login', baseUrl);
    // リダイレクト先も正しいURLを構築
    const originalUrl = new URL(request.url);
    const correctRedirectUrl = `${baseUrl}${originalUrl.pathname}${originalUrl.search}`;
    loginUrl.searchParams.set('redirect', correctRedirectUrl);
    return NextResponse.redirect(loginUrl.toString());
  }

  // 認可コードを生成
  const code = generateAuthorizationCode();
  const expiresAt = getAuthCodeExpiry();

  await prisma.authorizationCode.create({
    data: {
      code,
      clientId: client.id,
      userId: user.userId,
      redirectUri: params.redirect_uri,
      scope: params.scope || 'openid',
      codeChallenge: params.code_challenge,
      codeChallengeMethod: params.code_challenge_method,
      nonce: params.nonce,
      expiresAt,
    },
  });

  // セキュリティログ
  await prisma.securityLog.create({
    data: {
      userId: user.userId,
      action: 'oauth_authorize',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      details: { client_id: params.client_id, scope: params.scope },
    },
  });

  // 認可コードをリダイレクト
  const redirectUrl = new URL(params.redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (params.state) {
    redirectUrl.searchParams.set('state', params.state);
  }

  return NextResponse.redirect(redirectUrl.toString());
}

function buildErrorResponse(
  redirectUri: string,
  error: string,
  errorDescription: string,
  state?: string
): NextResponse {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', errorDescription);
  if (state) url.searchParams.set('state', state);
  return NextResponse.redirect(url.toString());
}
