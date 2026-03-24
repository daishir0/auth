import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';
import prisma from '@/lib/db';

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get('access_token')?.value;
  }

  if (!token) {
    return null;
  }

  return await verifyAccessToken(token);
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: トークン一覧取得
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await getAuthenticatedUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const hasPermission = currentUser.roles.includes('super_admin') ||
                          currentUser.roles.includes('admin');
    if (!hasPermission) {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // アプリケーションの存在確認
    const application = await prisma.oAuthClient.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: 'アプリケーションが見つかりません' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || 'active';

    const skip = (page - 1) * limit;
    const now = new Date();

    const where: {
      clientId: string;
      expiresAt?: { gt: Date } | { lte: Date };
    } = { clientId: id };

    if (status === 'active') {
      where.expiresAt = { gt: now };
    } else if (status === 'expired') {
      where.expiresAt = { lte: now };
    }

    const [tokens, total] = await Promise.all([
      prisma.refreshToken.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          scope: true,
          user: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.refreshToken.count({ where }),
    ]);

    return NextResponse.json({
      tokens: tokens.map((token) => ({
        id: token.id,
        createdAt: token.createdAt,
        expiresAt: token.expiresAt,
        scope: token.scope,
        isActive: token.expiresAt > now,
        user: {
          id: token.user.id,
          email: token.user.email,
          displayName: token.user.profile?.displayName || token.user.email,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Tokens list error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// DELETE: 全トークン無効化
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await getAuthenticatedUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const hasPermission = currentUser.roles.includes('super_admin') ||
                          currentUser.roles.includes('admin');
    if (!hasPermission) {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // アプリケーションの存在確認
    const application = await prisma.oAuthClient.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        name: true,
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: 'アプリケーションが見つかりません' },
        { status: 404 }
      );
    }

    // 全てのリフレッシュトークンを削除
    const deleteResult = await prisma.refreshToken.deleteMany({
      where: {
        clientId: id,
      },
    });

    // 未使用の認可コードも削除
    await prisma.authorizationCode.deleteMany({
      where: {
        clientId: id,
        usedAt: null,
      },
    });

    // 監査ログを記録
    await prisma.securityLog.create({
      data: {
        userId: currentUser.userId,
        action: 'oauth_client_tokens_revoked',
        details: {
          clientId: application.clientId,
          name: application.name,
          revokedTokenCount: deleteResult.count,
        },
      },
    });

    return NextResponse.json({
      success: true,
      revokedCount: deleteResult.count,
      message: `${deleteResult.count}件のトークンを無効化しました`,
    });
  } catch (error) {
    console.error('Tokens revoke error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
