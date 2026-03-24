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

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // admin/super_adminのみアクセス可能
    const isAdmin = currentUser.roles.includes('admin') || currentUser.roles.includes('super_admin');
    if (!isAdmin) {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    // 統計情報を取得
    const [totalUsers, activeUsers, totalOrganizations, totalPositions] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true, deletedAt: null } }),
      prisma.organization.count({ where: { isActive: true } }),
      prisma.position.count({ where: { isActive: true } }),
    ]);

    return NextResponse.json({
      totalUsers,
      activeUsers,
      totalOrganizations,
      totalPositions,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
