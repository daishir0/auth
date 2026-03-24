import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { authenticateRequest, hasPermission, forbiddenResponse } from '@/lib/api-auth';

// GET /api/organizations/:id/members - 組織メンバー一覧
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    if (!hasPermission(authResult.user, 'organizations:read')) {
      return forbiddenResponse();
    }

    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const includeEnded = searchParams.get('includeEnded') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // 組織存在確認
    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const where = {
      organizationId: id,
      ...(!includeEnded && {
        OR: [
          { endDate: null },
          { endDate: { gt: new Date() } },
        ],
      }),
    };

    const [memberships, total] = await Promise.all([
      prisma.organizationMembership.findMany({
        where,
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          position: true,
        },
        orderBy: [
          { position: { level: 'desc' } },
          { isPrimary: 'desc' },
          { startDate: 'asc' },
        ],
        skip,
        take: limit,
      }),
      prisma.organizationMembership.count({ where }),
    ]);

    return NextResponse.json({
      members: memberships.map(m => ({
        membershipId: m.id,
        user: {
          id: m.user.id,
          email: m.user.email,
          displayName: m.user.profile?.displayName,
          firstName: m.user.profile?.firstName,
          lastName: m.user.profile?.lastName,
          avatarUrl: m.user.profile?.avatarUrl,
        },
        position: m.position ? {
          id: m.position.id,
          name: m.position.name,
          code: m.position.code,
          level: m.position.level,
        } : null,
        isPrimary: m.isPrimary,
        startDate: m.startDate,
        endDate: m.endDate,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get organization members error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/organizations/:id/members - メンバー追加
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    if (!hasPermission(authResult.user, 'organizations:write')) {
      return forbiddenResponse();
    }

    const { id } = await params;
    const body = await request.json();
    const { userId, positionId, isPrimary, startDate } = body;

    // バリデーション
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // 組織存在確認
    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // ユーザー存在確認
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 既存のメンバーシップ確認
    const existingMembership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: id,
        },
      },
    });

    if (existingMembership) {
      // アクティブな場合はエラー
      if (!existingMembership.endDate || existingMembership.endDate > new Date()) {
        return NextResponse.json(
          { error: 'User is already a member of this organization' },
          { status: 409 }
        );
      }
      // 終了したメンバーシップは削除して新規作成
      await prisma.organizationMembership.delete({
        where: { id: existingMembership.id },
      });
    }

    // 主所属に設定する場合、他の主所属を解除
    if (isPrimary) {
      await prisma.organizationMembership.updateMany({
        where: {
          userId,
          isPrimary: true,
          OR: [
            { endDate: null },
            { endDate: { gt: new Date() } },
          ],
        },
        data: { isPrimary: false },
      });
    }

    const membership = await prisma.organizationMembership.create({
      data: {
        userId,
        organizationId: id,
        positionId,
        isPrimary: isPrimary || false,
        startDate: startDate ? new Date(startDate) : new Date(),
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        position: true,
      },
    });

    return NextResponse.json(
      {
        message: 'Member added successfully',
        membership: {
          id: membership.id,
          user: {
            id: membership.user.id,
            email: membership.user.email,
            displayName: membership.user.profile?.displayName,
          },
          position: membership.position,
          isPrimary: membership.isPrimary,
          startDate: membership.startDate,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Add organization member error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
