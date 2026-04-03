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
    const { id: userId } = await params;
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        globalRoles: {
          include: {
            role: true,
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
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    // 全ロールを取得
    const allRoles = await prisma.globalRole.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        profile: user.profile,
        roles: user.globalRoles.map((ur) => ur.role.name),
        organizations: user.organizationMemberships.map((om) => ({
          id: om.organization.id,
          name: om.organization.name,
          code: om.organization.code,
          isPrimary: om.isPrimary,
          membershipId: om.id,
          position: om.position
            ? {
                id: om.position.id,
                name: om.position.name,
              }
            : null,
        })),
      },
      allRoles: allRoles.map((role) => ({
        id: role.id,
        name: role.name,
        displayName: role.displayName,
      })),
    });
  } catch (error) {
    console.error('User detail error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
