import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { verifyAccessToken, TokenPayload } from '@/lib/auth';

export interface AuthenticatedRequest {
  user: TokenPayload & {
    permissions: string[];
  };
}

/**
 * リクエストからトークンを取得して検証
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<{ user: AuthenticatedRequest['user'] } | { error: NextResponse }> {
  // Authorizationヘッダーまたはクッキーからトークン取得
  const authHeader = request.headers.get('authorization');
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get('access_token')?.value;
  }

  if (!token) {
    return {
      error: NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      ),
    };
  }

  const payload = await verifyAccessToken(token);

  if (!payload) {
    return {
      error: NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      ),
    };
  }

  // ユーザーの権限を取得
  const userWithPermissions = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
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
    },
  });

  if (!userWithPermissions || !userWithPermissions.isActive) {
    return {
      error: NextResponse.json(
        { error: 'User not found or disabled' },
        { status: 401 }
      ),
    };
  }

  // 権限名の配列を作成
  const permissions = new Set<string>();
  for (const userRole of userWithPermissions.globalRoles) {
    for (const rolePermission of userRole.role.permissions) {
      permissions.add(rolePermission.permission.name);
    }
  }

  return {
    user: {
      ...payload,
      permissions: Array.from(permissions),
    },
  };
}

/**
 * 権限チェック
 */
export function hasPermission(
  user: AuthenticatedRequest['user'],
  requiredPermission: string
): boolean {
  // system:admin権限があれば全ての権限を持つ
  if (user.permissions.includes('system:admin')) {
    return true;
  }
  return user.permissions.includes(requiredPermission);
}

/**
 * 複数の権限のいずれかを持っているかチェック
 */
export function hasAnyPermission(
  user: AuthenticatedRequest['user'],
  requiredPermissions: string[]
): boolean {
  if (user.permissions.includes('system:admin')) {
    return true;
  }
  return requiredPermissions.some(p => user.permissions.includes(p));
}

/**
 * 権限不足エラーレスポンス
 */
export function forbiddenResponse(message = 'Permission denied'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}
