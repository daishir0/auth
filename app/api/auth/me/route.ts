import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
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
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    const payload = await verifyAccessToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // DBからユーザー情報を取得
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        profile: true,
        credential: {
          select: {
            hashedPassword: true,
            googleId: true,
          },
        },
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
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is disabled' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        profile: user.profile ? {
          displayName: user.profile.displayName,
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          avatarUrl: user.profile.avatarUrl,
          phone: user.profile.phone,
          hireDate: user.profile.hireDate,
        } : null,
        roles: user.globalRoles.map(ur => ur.role.name),
        organizations: user.organizationMemberships.map(om => ({
          id: om.organization.id,
          name: om.organization.name,
          code: om.organization.code,
          isPrimary: om.isPrimary,
          position: om.position ? {
            id: om.position.id,
            name: om.position.name,
            code: om.position.code,
          } : null,
        })),
        authMethods: {
          hasPassword: !!user.credential?.hashedPassword,
          hasGoogle: !!user.credential?.googleId,
        },
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
