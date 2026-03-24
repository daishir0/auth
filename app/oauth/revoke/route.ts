/**
 * OAuth 2.0 トークン無効化 エンドポイント
 * RFC 7009: OAuth 2.0 Token Revocation
 * トークンを無効化する
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyClientCredentials } from '@/lib/oauth-auth';

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

interface RevokeRequest {
  token: string;
  token_type_hint?: 'access_token' | 'refresh_token';
}

async function parseRequest(request: NextRequest): Promise<RevokeRequest> {
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
  try {
    const { clientId, clientSecret } = getClientCredentials(request);

    // クライアント認証
    let client = null;
    if (clientId && clientSecret) {
      client = await prisma.oAuthClient.findUnique({
        where: { clientId },
      });

      if (!client || !(await verifyClientCredentials(clientSecret, client.clientSecret))) {
        return NextResponse.json(
          { error: 'invalid_client', error_description: 'Invalid client credentials' },
          { status: 401, headers: corsHeaders() }
        );
      }
    }

    const body = await parseRequest(request);

    if (!body.token) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'token is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // リフレッシュトークンを検索して削除
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token: body.token },
    });

    if (refreshToken) {
      // クライアント認証されている場合、クライアントIDを検証
      if (client && refreshToken.clientId && refreshToken.clientId !== client.id) {
        // RFC 7009: トークンが見つからない場合と同じ応答（セキュリティ上）
        return new NextResponse(null, { status: 200, headers: corsHeaders() });
      }

      await prisma.refreshToken.delete({
        where: { id: refreshToken.id },
      });

      // セキュリティログ
      await prisma.securityLog.create({
        data: {
          userId: refreshToken.userId,
          action: 'oauth_token_revoked',
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          details: JSON.stringify({
            client_id: clientId,
            token_type: 'refresh_token',
          }),
        },
      });
    }

    // RFC 7009: 成功の場合は200 OKを返す（トークンが存在しなかった場合も）
    return new NextResponse(null, { status: 200, headers: corsHeaders() });
  } catch (error) {
    console.error('Revoke endpoint error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
