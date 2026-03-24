/**
 * OpenID Connect UserInfo エンドポイント
 * RFC 7662: OpenID Connect Core 1.0
 * 認証済みユーザーの情報を返す
 *
 * カスタムスコープ:
 * - openid: 必須、subクレームを含む
 * - profile: プロフィール情報（displayName, firstName, lastName, avatarUrl, hireDate）
 * - email: メールアドレス
 * - custom: 組織・役職情報
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

  // ユーザー情報を取得（拡張情報含む）
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      profile: true,
      globalRoles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
        where: {
          OR: [
            { validTo: null },
            { validTo: { gt: new Date() } },
          ],
        },
      },
      organizationMemberships: {
        include: {
          organization: true,
          position: true,
        },
        where: {
          OR: [
            { endDate: null },
            { endDate: { gt: new Date() } },
          ],
        },
        orderBy: [
          { isPrimary: 'desc' },
          { startDate: 'desc' },
        ],
      },
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: 'invalid_token', error_description: 'User not found' },
      { status: 401, headers: { ...corsHeaders(), 'WWW-Authenticate': 'Bearer error="invalid_token"' } }
    );
  }

  if (!user.isActive) {
    return NextResponse.json(
      { error: 'invalid_token', error_description: 'User account is disabled' },
      { status: 401, headers: { ...corsHeaders(), 'WWW-Authenticate': 'Bearer error="invalid_token"' } }
    );
  }

  // ロール名配列を取得
  const roles = user.globalRoles.map(ur => ur.role.name);

  // 権限の集約
  const permissions = new Set<string>();
  for (const userRole of user.globalRoles) {
    for (const rolePermission of userRole.role.permissions) {
      permissions.add(rolePermission.permission.name);
    }
  }

  // OIDC標準のクレーム形式で返す（基本情報）
  const userInfo: Record<string, unknown> = {
    sub: user.id,
    email: user.email,
    email_verified: true, // 現在の実装ではメール検証なし
    roles,
    permissions: Array.from(permissions),
    updated_at: Math.floor(user.updatedAt.getTime() / 1000),
  };

  // プロフィール情報（profile スコープ）
  const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'https://auth.senku.work';

  if (user.profile) {
    userInfo.name = user.profile.displayName || `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim() || user.email.split('@')[0];
    userInfo.given_name = user.profile.firstName;
    userInfo.family_name = user.profile.lastName;
    userInfo.nickname = user.profile.displayName;
    // pictureは絶対URLで返す
    userInfo.picture = user.profile.avatarUrl
      ? (user.profile.avatarUrl.startsWith('http') ? user.profile.avatarUrl : `${baseUrl}${user.profile.avatarUrl}`)
      : `${baseUrl}/avatars/default.png`;
    userInfo.phone_number = user.profile.phone;

    // カスタムプロフィールクレーム
    userInfo.profile = {
      display_name: user.profile.displayName,
      first_name: user.profile.firstName,
      last_name: user.profile.lastName,
      avatar_url: user.profile.avatarUrl,
      phone: user.profile.phone,
      hire_date: user.profile.hireDate?.toISOString(),
      metadata: user.profile.metadata,
    };
  } else {
    userInfo.name = user.email.split('@')[0];
    userInfo.picture = `${baseUrl}/avatars/default.png`;
  }

  // 組織・役職情報（custom スコープ）
  const primaryOrg = user.organizationMemberships.find(m => m.isPrimary);

  userInfo.organizations = user.organizationMemberships.map(m => ({
    id: m.organization.id,
    name: m.organization.name,
    code: m.organization.code,
    is_primary: m.isPrimary,
    position: m.position ? {
      id: m.position.id,
      name: m.position.name,
      code: m.position.code,
      level: m.position.level,
    } : null,
    start_date: m.startDate.toISOString(),
    end_date: m.endDate?.toISOString(),
  }));

  // 主所属の組織・役職（簡易アクセス用）
  if (primaryOrg) {
    userInfo.primary_organization = {
      id: primaryOrg.organization.id,
      name: primaryOrg.organization.name,
      code: primaryOrg.organization.code,
    };
    if (primaryOrg.position) {
      userInfo.primary_position = {
        id: primaryOrg.position.id,
        name: primaryOrg.position.name,
        code: primaryOrg.position.code,
        level: primaryOrg.position.level,
      };
    }
  }

  return NextResponse.json(userInfo, { headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
  return handleUserInfo(request);
}

export async function POST(request: NextRequest) {
  return handleUserInfo(request);
}
