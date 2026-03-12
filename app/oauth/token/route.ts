/**
 * OAuth 2.0 トークンエンドポイント
 * RFC 6749: The OAuth 2.0 Authorization Framework
 * Authorization Code Grant / Refresh Token Grant を実装
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  generateAccessToken,
  generateIdToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  verifyCodeChallenge,
  verifyClientCredentials,
} from '@/lib/oauth-auth';

// CORSヘッダー
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

interface TokenRequest {
  grant_type: string;
  code?: string;
  redirect_uri?: string;
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
  code_verifier?: string;
  scope?: string;
}

async function parseRequest(request: NextRequest): Promise<TokenRequest> {
  const contentType = request.headers.get('content-type');

  if (contentType?.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    return {
      grant_type: formData.get('grant_type') as string,
      code: formData.get('code') as string || undefined,
      redirect_uri: formData.get('redirect_uri') as string || undefined,
      client_id: formData.get('client_id') as string || undefined,
      client_secret: formData.get('client_secret') as string || undefined,
      refresh_token: formData.get('refresh_token') as string || undefined,
      code_verifier: formData.get('code_verifier') as string || undefined,
      scope: formData.get('scope') as string || undefined,
    };
  } else {
    const body = await request.json();
    return body;
  }
}

function getClientCredentials(request: NextRequest, body: TokenRequest): { clientId?: string; clientSecret?: string } {
  // Basic認証ヘッダーから取得
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const [clientId, clientSecret] = decoded.split(':');
    return { clientId, clientSecret };
  }

  // リクエストボディから取得
  return {
    clientId: body.client_id,
    clientSecret: body.client_secret,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseRequest(request);
    const { clientId, clientSecret } = getClientCredentials(request, body);

    if (!body.grant_type) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'grant_type is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (!clientId) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'client_id is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // クライアントを検証
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId },
    });

    if (!client || !client.isActive) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Client not found or inactive' },
        { status: 401, headers: corsHeaders() }
      );
    }

    // クライアントシークレットを検証
    if (clientSecret && !verifyClientCredentials(clientSecret, client.clientSecret)) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Invalid client credentials' },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Grant Typeに応じて処理
    const allowedGrants = client.grantTypes.split(',').map(g => g.trim());

    switch (body.grant_type) {
      case 'authorization_code':
        if (!allowedGrants.includes('authorization_code')) {
          return NextResponse.json(
            { error: 'unauthorized_client', error_description: 'Grant type not allowed' },
            { status: 400, headers: corsHeaders() }
          );
        }
        return handleAuthorizationCodeGrant(request, body, client);

      case 'refresh_token':
        if (!allowedGrants.includes('refresh_token')) {
          return NextResponse.json(
            { error: 'unauthorized_client', error_description: 'Grant type not allowed' },
            { status: 400, headers: corsHeaders() }
          );
        }
        return handleRefreshTokenGrant(body, client);

      default:
        return NextResponse.json(
          { error: 'unsupported_grant_type', error_description: 'Unsupported grant type' },
          { status: 400, headers: corsHeaders() }
        );
    }
  } catch (error) {
    console.error('Token endpoint error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

async function handleAuthorizationCodeGrant(
  request: NextRequest,
  body: TokenRequest,
  client: { id: string; clientId: string }
) {
  if (!body.code) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'code is required' },
      { status: 400, headers: corsHeaders() }
    );
  }

  if (!body.redirect_uri) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'redirect_uri is required' },
      { status: 400, headers: corsHeaders() }
    );
  }

  // 認可コードを検索
  const authCode = await prisma.authorizationCode.findUnique({
    where: { code: body.code },
    include: { user: true },
  });

  if (!authCode) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Invalid authorization code' },
      { status: 400, headers: corsHeaders() }
    );
  }

  // 有効期限チェック
  if (authCode.expiresAt < new Date()) {
    await prisma.authorizationCode.delete({ where: { id: authCode.id } });
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Authorization code expired' },
      { status: 400, headers: corsHeaders() }
    );
  }

  // 使用済みチェック
  if (authCode.usedAt) {
    // リプレイ攻撃の可能性 - 関連するトークンを無効化
    await prisma.refreshToken.deleteMany({
      where: { clientId: client.id, userId: authCode.userId },
    });
    await prisma.authorizationCode.delete({ where: { id: authCode.id } });
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Authorization code already used' },
      { status: 400, headers: corsHeaders() }
    );
  }

  // クライアントIDチェック
  if (authCode.clientId !== client.id) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Authorization code was not issued to this client' },
      { status: 400, headers: corsHeaders() }
    );
  }

  // redirect_uriチェック
  if (authCode.redirectUri !== body.redirect_uri) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'redirect_uri mismatch' },
      { status: 400, headers: corsHeaders() }
    );
  }

  // PKCE検証
  if (authCode.codeChallenge) {
    if (!body.code_verifier) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'code_verifier is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const method = (authCode.codeChallengeMethod as 'S256' | 'plain') || 'S256';
    if (!verifyCodeChallenge(body.code_verifier, authCode.codeChallenge, method)) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Invalid code_verifier' },
        { status: 400, headers: corsHeaders() }
      );
    }
  }

  // 認可コードを使用済みに
  await prisma.authorizationCode.update({
    where: { id: authCode.id },
    data: { usedAt: new Date() },
  });

  // トークンを生成
  const user = authCode.user;
  const roles = user.roles.split(',').map(r => r.trim());

  const tokenPayload = {
    userId: user.id,
    email: user.email,
    roles,
  };

  const accessToken = await generateAccessToken(tokenPayload, client.clientId, authCode.scope);
  const refreshToken = generateRefreshToken();

  // リフレッシュトークンを保存
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      clientId: client.id,
      scope: authCode.scope,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  // セキュリティログ
  await prisma.securityLog.create({
    data: {
      userId: user.id,
      action: 'oauth_token_issued',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      details: JSON.stringify({ client_id: client.clientId, scope: authCode.scope, grant_type: 'authorization_code' }),
    },
  });

  // レスポンス構築
  const response: Record<string, unknown> = {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 900, // 15分
    refresh_token: refreshToken,
    scope: authCode.scope,
  };

  // OIDCスコープがあればID Tokenも発行
  if (authCode.scope.includes('openid')) {
    const idToken = await generateIdToken(
      { ...tokenPayload, auth_time: Math.floor(Date.now() / 1000) },
      client.clientId,
      authCode.nonce || undefined
    );
    response.id_token = idToken;
  }

  return NextResponse.json(response, { headers: corsHeaders() });
}

async function handleRefreshTokenGrant(
  body: TokenRequest,
  client: { id: string; clientId: string }
) {
  if (!body.refresh_token) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'refresh_token is required' },
      { status: 400, headers: corsHeaders() }
    );
  }

  // リフレッシュトークンを検索
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: body.refresh_token },
    include: { user: true },
  });

  if (!storedToken) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Invalid refresh token' },
      { status: 400, headers: corsHeaders() }
    );
  }

  // 有効期限チェック
  if (storedToken.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Refresh token expired' },
      { status: 400, headers: corsHeaders() }
    );
  }

  // クライアントIDチェック（OAuthトークンの場合）
  if (storedToken.clientId && storedToken.clientId !== client.id) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Refresh token was not issued to this client' },
      { status: 400, headers: corsHeaders() }
    );
  }

  // 新しいトークンを生成
  const user = storedToken.user;
  const roles = user.roles.split(',').map(r => r.trim());
  const scope = body.scope || storedToken.scope || 'openid';

  const tokenPayload = {
    userId: user.id,
    email: user.email,
    roles,
  };

  const accessToken = await generateAccessToken(tokenPayload, client.clientId, scope);
  const newRefreshToken = generateRefreshToken();

  // トランザクションでトークンを更新
  await prisma.$transaction([
    prisma.refreshToken.delete({ where: { id: storedToken.id } }),
    prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        clientId: client.id,
        scope,
        expiresAt: getRefreshTokenExpiry(),
      },
    }),
  ]);

  const response: Record<string, unknown> = {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 900,
    refresh_token: newRefreshToken,
    scope,
  };

  // OIDCスコープがあればID Tokenも発行
  if (scope.includes('openid')) {
    const idToken = await generateIdToken(
      { ...tokenPayload, auth_time: Math.floor(Date.now() / 1000) },
      client.clientId
    );
    response.id_token = idToken;
  }

  return NextResponse.json(response, { headers: corsHeaders() });
}
