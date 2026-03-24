import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { authenticateRequest, hasPermission, forbiddenResponse } from '@/lib/api-auth';

// GET /api/users/:id/profile - プロフィール取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    const { id } = await params;

    // 自分自身の情報は閲覧可能、それ以外はusers:read権限が必要
    if (authResult.user.userId !== id && !hasPermission(authResult.user, 'users:read')) {
      return forbiddenResponse();
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId: id },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      profile: {
        displayName: profile.displayName,
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatarUrl: profile.avatarUrl,
        phone: profile.phone,
        hireDate: profile.hireDate,
        metadata: profile.metadata,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/users/:id/profile - プロフィール更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    const { id } = await params;

    // 自分自身の情報は更新可能、それ以外はusers:write権限が必要
    if (authResult.user.userId !== id && !hasPermission(authResult.user, 'users:write')) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const { displayName, firstName, lastName, phone, hireDate, metadata } = body;

    // ユーザー存在確認
    const user = await prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // プロフィール作成または更新
    const profile = await prisma.userProfile.upsert({
      where: { userId: id },
      update: {
        ...(displayName !== undefined && { displayName }),
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(hireDate !== undefined && { hireDate: hireDate ? new Date(hireDate) : null }),
        ...(metadata !== undefined && { metadata }),
      },
      create: {
        userId: id,
        displayName,
        firstName,
        lastName,
        phone,
        hireDate: hireDate ? new Date(hireDate) : undefined,
        metadata,
      },
    });

    return NextResponse.json({
      message: 'Profile updated successfully',
      profile: {
        displayName: profile.displayName,
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatarUrl: profile.avatarUrl,
        phone: profile.phone,
        hireDate: profile.hireDate,
        metadata: profile.metadata,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
