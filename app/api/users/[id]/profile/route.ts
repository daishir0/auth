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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await params;
    const currentUser = await getAuthenticatedUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // 自分自身のプロフィールか、admin/super_adminのみ取得可能
    const isAdmin = currentUser.roles.includes('admin') || currentUser.roles.includes('super_admin');
    if (currentUser.userId !== targetUserId && !isAdmin) {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId: targetUserId },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Profile get error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await params;
    const currentUser = await getAuthenticatedUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // 自分自身のプロフィールか、admin/super_adminのみ更新可能
    const isAdmin = currentUser.roles.includes('admin') || currentUser.roles.includes('super_admin');
    if (currentUser.userId !== targetUserId && !isAdmin) {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { displayName, firstName, lastName, phone, hireDate } = body;

    // hireDateを日付型に変換（空文字やnullの場合はnull）
    const parsedHireDate = hireDate ? new Date(hireDate) : null;

    // プロフィールを更新または作成
    const profile = await prisma.userProfile.upsert({
      where: { userId: targetUserId },
      update: {
        displayName: displayName || null,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        hireDate: parsedHireDate,
      },
      create: {
        userId: targetUserId,
        displayName: displayName || null,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        hireDate: parsedHireDate,
      },
    });

    return NextResponse.json({
      message: 'プロフィールを更新しました',
      profile,
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
