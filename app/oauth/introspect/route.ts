/**
 * OAuth 2.0 トークンイントロスペクション エンドポイント
 * RFC 7662: OAuth 2.0 Token Introspection
 * トークンの有効性と情報を確認する
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken, verifyClientCredentials } from '@/lib/oauth-auth';
import { corsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

interface IntrospectRequest {
  token: string;
  token_type_hint?: 'access_token' | 'refresh_token';
}

async function parseRequest(request: NextRequest): Promise<IntrospectRequest> {
  const contentType = request.headers.get('content-type');

  if (contentType?.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    return {
      token: formData.get('token') as string,
      token_type_hint: formData.get('token_type_hint') as 'access_token' | 'refresh_token' | undefined,
    };
  } else {
    const body = await request.json();
    return body;
  }
}

function getClientCredentials(request: NextRequest): { clientId?: string; clientSecret?: string } {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const [clientId, clientSecret] = decoded.split(':');
    return { clientId, clientSecret };
  }
  return {};
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  try {
    const { clientId, clientSecret } = getClientCredentials(request);

    // クライアント認証（オプション、ただし推奨）
    if (clientId && clientSecret) {
      const client = await prisma.oAuthClient.findUnique({
        where: { clientId },
      });

      if (!client || !(await verifyClientCredentials(clientSecret, client.clientSecret))) {
        return NextResponse.json(
          { error: 'invalid_client', error_description: 'Invalid client credentials' },
          { status: 401, headers: corsHeaders(origin) }
        );
      }
    }

    const body = await parseRequest(request);

    if (!body.token) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'token is required' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // アクセストークンを検証（RS256）
    let payload = await verifyAccessToken(body.token);
    let tokenType = 'access_token';

    if (!payload) {
      // リフレッシュトークンかもしれない
      const refreshToken = await prisma.refreshToken.findUnique({
        where: { token: body.token },
        include: { user: true },
      });

      if (refreshToken && refreshToken.expiresAt > new Date()) {
        const user = refreshToken.user;
        return NextResponse.json(
          {
            active: true,
            token_type: 'refresh_token',
            client_id: refreshToken.clientId,
            sub: user.id,
            email: user.email,
            scope: refreshToken.scope || 'openid',
            exp: Math.floor(refreshToken.expiresAt.getTime() / 1000),
            iat: Math.floor(refreshToken.createdAt.getTime() / 1000),
          },
          { headers: corsHeaders(origin) }
        );
      }

      // トークンが無効
      return NextResponse.json({ active: false }, { headers: corsHeaders(origin) });
    }

    // ユーザー情報を取得
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return NextResponse.json({ active: false }, { headers: corsHeaders(origin) });
    }

    // アクティブなトークン
    return NextResponse.json(
      {
        active: true,
        token_type: tokenType,
        sub: user.id,
        email: user.email,
        roles: payload.roles,
        scope: 'openid profile email',
        // JWTからexp/iatを取得するのは難しいので省略
      },
      { headers: corsHeaders(origin) }
    );
  } catch (error) {
    console.error('Introspect endpoint error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
