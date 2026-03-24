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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const currentUser = await getAuthenticatedUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // super_adminのみロール付与可能（adminはロール変更不可）
    const isSuperAdmin = currentUser.roles.includes('super_admin');
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { roleName } = body;

    if (!roleName) {
      return NextResponse.json(
        { error: 'ロール名が必要です' },
        { status: 400 }
      );
    }

    // ロールの存在確認
    const role = await prisma.globalRole.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      return NextResponse.json(
        { error: 'ロールが見つかりません' },
        { status: 404 }
      );
    }

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    // ロールを付与
    await prisma.userGlobalRole.create({
      data: {
        userId,
        roleId: role.id,
      },
    });

    return NextResponse.json({
      message: 'ロールを付与しました',
    });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'このロールは既に付与されています' },
        { status: 400 }
      );
    }
    console.error('Role add error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const currentUser = await getAuthenticatedUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // super_adminのみロール削除可能
    const isSuperAdmin = currentUser.roles.includes('super_admin');
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    // 自分自身のsuper_adminロールは削除不可
    if (currentUser.userId === userId) {
      return NextResponse.json(
        { error: '自分自身のロールは変更できません' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { roleName } = body;

    if (!roleName) {
      return NextResponse.json(
        { error: 'ロール名が必要です' },
        { status: 400 }
      );
    }

    // ロールの存在確認
    const role = await prisma.globalRole.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      return NextResponse.json(
        { error: 'ロールが見つかりません' },
        { status: 404 }
      );
    }

    // ロールを削除
    await prisma.userGlobalRole.deleteMany({
      where: {
        userId,
        roleId: role.id,
      },
    });

    return NextResponse.json({
      message: 'ロールを削除しました',
    });
  } catch (error) {
    console.error('Role delete error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
