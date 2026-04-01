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
  params: Promise<{ id: string; appId: string }>;
}

// DELETE: ユーザーのアプリケーションアクセス権を削除
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

    const { id: userId, appId: applicationId } = await params;

    // アクセス権の存在確認
    const access = await prisma.userApplicationAccess.findUnique({
      where: {
        userId_applicationId: {
          userId,
          applicationId,
        },
      },
      include: {
        user: { select: { email: true } },
        application: { select: { name: true, clientId: true } },
      },
    });

    if (!access) {
      return NextResponse.json(
        { error: 'アクセス権が見つかりません' },
        { status: 404 }
      );
    }

    // アクセス権を削除
    await prisma.userApplicationAccess.delete({
      where: {
        userId_applicationId: {
          userId,
          applicationId,
        },
      },
    });

    // 監査ログを記録
    await prisma.securityLog.create({
      data: {
        userId: currentUser.userId,
        action: 'application_access_revoked',
        details: {
          targetUserId: userId,
          targetUserEmail: access.user.email,
          applicationId: access.applicationId,
          applicationName: access.application.name,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Revoke application access error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
