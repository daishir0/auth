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

// GET: このアプリケーションにアクセス可能なユーザー一覧
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

    const { id: applicationId } = await params;

    // アプリケーションの存在確認
    const application = await prisma.oAuthClient.findUnique({
      where: { id: applicationId },
      select: { id: true, name: true, clientId: true },
    });

    if (!application) {
      return NextResponse.json(
        { error: 'アプリケーションが見つかりません' },
        { status: 404 }
      );
    }

    // アクセス権を持つユーザー一覧を取得
    const accessList = await prisma.userApplicationAccess.findMany({
      where: { applicationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
            profile: {
              select: {
                displayName: true,
                firstName: true,
                lastName: true,
              },
            },
            globalRoles: {
              include: {
                role: {
                  select: { name: true, displayName: true },
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
        },
      },
      orderBy: { grantedAt: 'desc' },
    });

    // 付与者の情報を別途取得
    const grantedByIds = accessList
      .map((a) => a.grantedBy)
      .filter((id): id is string => id !== null);

    const granters = grantedByIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: grantedByIds } },
          select: { id: true, email: true, profile: { select: { displayName: true } } },
        })
      : [];

    const granterMap = new Map(granters.map((g) => [g.id, g]));

    const users = accessList.map((access) => {
      const granter = access.grantedBy ? granterMap.get(access.grantedBy) : null;
      return {
        accessId: access.id,
        userId: access.userId,
        email: access.user.email,
        isActive: access.user.isActive,
        displayName: access.user.profile?.displayName ||
          (access.user.profile?.lastName && access.user.profile?.firstName
            ? `${access.user.profile.lastName} ${access.user.profile.firstName}`
            : null),
        roles: access.user.globalRoles.map((ur) => ur.role.name),
        grantedAt: access.grantedAt,
        grantedBy: granter
          ? {
              id: granter.id,
              email: granter.email,
              displayName: granter.profile?.displayName,
            }
          : null,
      };
    });

    // アクセス権のないユーザー一覧（追加用）
    const grantedUserIds = new Set(accessList.map((a) => a.userId));
    const availableUsers = await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(grantedUserIds) },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        profile: {
          select: {
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { email: 'asc' },
      take: 100, // パフォーマンス対策
    });

    const availableUsersList = availableUsers.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.profile?.displayName ||
        (user.profile?.lastName && user.profile?.firstName
          ? `${user.profile.lastName} ${user.profile.firstName}`
          : null),
    }));

    return NextResponse.json({
      users,
      availableUsers: availableUsersList,
      totalCount: users.length,
    });
  } catch (error) {
    console.error('Application access list error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// POST: ユーザーにアプリケーションへのアクセス権を付与
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const { id: applicationId } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId は必須です' },
        { status: 400 }
      );
    }

    // アプリケーションの存在確認
    const application = await prisma.oAuthClient.findUnique({
      where: { id: applicationId },
      select: { id: true, name: true, clientId: true },
    });

    if (!application) {
      return NextResponse.json(
        { error: 'アプリケーションが見つかりません' },
        { status: 404 }
      );
    }

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    // 既存のアクセス権チェック
    const existingAccess = await prisma.userApplicationAccess.findUnique({
      where: {
        userId_applicationId: {
          userId,
          applicationId,
        },
      },
    });

    if (existingAccess) {
      return NextResponse.json(
        { error: 'このユーザーには既にこのアプリケーションへのアクセス権があります' },
        { status: 409 }
      );
    }

    // アクセス権を付与
    const access = await prisma.userApplicationAccess.create({
      data: {
        userId,
        applicationId,
        grantedBy: currentUser.userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                displayName: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // 監査ログを記録
    await prisma.securityLog.create({
      data: {
        userId: currentUser.userId,
        action: 'application_access_granted',
        details: {
          targetUserId: userId,
          targetUserEmail: user.email,
          applicationId: application.id,
          applicationName: application.name,
        },
      },
    });

    return NextResponse.json({
      accessId: access.id,
      userId: access.userId,
      email: access.user.email,
      displayName: access.user.profile?.displayName ||
        (access.user.profile?.lastName && access.user.profile?.firstName
          ? `${access.user.profile.lastName} ${access.user.profile.firstName}`
          : null),
      grantedAt: access.grantedAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Grant application access error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
