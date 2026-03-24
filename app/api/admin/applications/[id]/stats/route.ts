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

// GET: アプリケーション利用統計
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

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 並行してデータを取得
    const [
      activeTokens,
      totalAuthorizations,
      last30DaysAuth,
      latestToken,
    ] = await Promise.all([
      // 有効なリフレッシュトークン数
      prisma.refreshToken.count({
        where: {
          clientId: id,
          expiresAt: { gt: now },
        },
      }),
      // 累計認可数（発行された認可コード数）
      prisma.authorizationCode.count({
        where: {
          clientId: id,
        },
      }),
      // 過去30日の認可数
      prisma.authorizationCode.count({
        where: {
          clientId: id,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      // 最後に発行されたトークン
      prisma.refreshToken.findFirst({
        where: {
          clientId: id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      activeTokens,
      totalAuthorizations,
      last30DaysAuth,
      lastUsedAt: latestToken?.createdAt || null,
    });
  } catch (error) {
    console.error('Application stats error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
