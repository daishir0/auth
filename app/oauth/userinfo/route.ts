/**
 * OpenID Connect UserInfo エンドポイント
 * RFC 7662: OpenID Connect Core 1.0
 * 認証済みユーザーの情報を返す
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken, verifyLegacyAccessToken } from '@/lib/oauth-auth';

// CORSヘッダー
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

async function handleUserInfo(request: NextRequest) {
  // Authorization ヘッダーからトークンを取得
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'invalid_token', error_description: 'Bearer token required' },
      { status: 401, headers: { ...corsHeaders(), 'WWW-Authenticate': 'Bearer' } }
    );
  }

  const token = authHeader.slice(7);

  // トークンを検証（RS256を試行、失敗したらHS256）
  let payload = await verifyAccessToken(token);
  if (!payload) {
    payload = await verifyLegacyAccessToken(token);
  }

  if (!payload) {
    return NextResponse.json(
      { error: 'invalid_token', error_description: 'Token is invalid or expired' },
      { status: 401, headers: { ...corsHeaders(), 'WWW-Authenticate': 'Bearer error="invalid_token"' } }
    );
  }

  // ユーザー情報を取得
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      roles: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: 'invalid_token', error_description: 'User not found' },
      { status: 401, headers: { ...corsHeaders(), 'WWW-Authenticate': 'Bearer error="invalid_token"' } }
    );
  }

  // OIDC標準のクレーム形式で返す
  const userInfo = {
    sub: user.id,
    email: user.email,
    email_verified: true, // 現在の実装ではメール検証なし
    roles: user.roles.split(',').map(r => r.trim()),
    updated_at: Math.floor(user.updatedAt.getTime() / 1000),
  };

  return NextResponse.json(userInfo, { headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
  return handleUserInfo(request);
}

export async function POST(request: NextRequest) {
  return handleUserInfo(request);
}
