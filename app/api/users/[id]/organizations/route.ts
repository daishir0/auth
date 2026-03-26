import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { authenticateRequest, hasPermission, forbiddenResponse } from '@/lib/api-auth';

// GET /api/users/:id/organizations - ユーザーの所属組織一覧
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

    const { searchParams } = new URL(request.url);
    const includeEnded = searchParams.get('includeEnded') === 'true';

    const memberships = await prisma.organizationMembership.findMany({
      where: {
        userId: id,
        ...(!includeEnded && {
          OR: [
            { endDate: null },
            { endDate: { gt: new Date() } },
          ],
        }),
      },
      include: {
        organization: true,
        position: true,
      },
      orderBy: [
        { isPrimary: 'desc' },
        { startDate: 'desc' },
      ],
    });

    return NextResponse.json({
      organizations: memberships.map(m => ({
        membershipId: m.id,
        organization: {
          id: m.organization.id,
          name: m.organization.name,
          code: m.organization.code,
          description: m.organization.description,
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
    });
  } catch (error) {
    console.error('Get user organizations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/users/:id/organizations - 所属組織追加
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    const { id } = await params;

    // users:write権限が必要
    if (!hasPermission(authResult.user, 'users:write')) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const { organizationId, positionId, isPrimary } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: '組織IDは必須です' },
        { status: 400 }
      );
    }

    // 組織の存在確認
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: '指定された組織が見つかりません' },
        { status: 404 }
      );
    }

    // 役職の存在確認（指定されている場合）
    if (positionId) {
      const position = await prisma.position.findUnique({
        where: { id: positionId },
      });

      if (!position) {
        return NextResponse.json(
          { error: '指定された役職が見つかりません' },
          { status: 404 }
        );
      }
    }

    // 既に同じ組織に所属していないか確認
    const existingMembership = await prisma.organizationMembership.findFirst({
      where: {
        userId: id,
        organizationId,
        OR: [
          { endDate: null },
          { endDate: { gt: new Date() } },
        ],
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: 'この組織には既に所属しています' },
        { status: 400 }
      );
    }

    // isPrimaryがtrueの場合、他の主所属を解除
    if (isPrimary) {
      await prisma.organizationMembership.updateMany({
        where: {
          userId: id,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    // 所属を追加
    const membership = await prisma.organizationMembership.create({
      data: {
        userId: id,
        organizationId,
        positionId: positionId || null,
        isPrimary: isPrimary || false,
        startDate: new Date(),
      },
      include: {
        organization: true,
        position: true,
      },
    });

    return NextResponse.json({
      message: '所属組織を追加しました',
      membership: {
        membershipId: membership.id,
        organization: {
          id: membership.organization.id,
          name: membership.organization.name,
          code: membership.organization.code,
        },
        position: membership.position ? {
          id: membership.position.id,
          name: membership.position.name,
        } : null,
        isPrimary: membership.isPrimary,
        startDate: membership.startDate,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Add organization membership error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/:id/organizations - 所属組織削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    const { id } = await params;

    // users:write権限が必要
    if (!hasPermission(authResult.user, 'users:write')) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const membershipId = searchParams.get('membershipId');

    if (!membershipId) {
      return NextResponse.json(
        { error: 'membershipIdは必須です' },
        { status: 400 }
      );
    }

    // 所属の存在確認
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        id: membershipId,
        userId: id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: '指定された所属が見つかりません' },
        { status: 404 }
      );
    }

    // 所属を削除
    await prisma.organizationMembership.delete({
      where: { id: membershipId },
    });

    return NextResponse.json({
      message: '所属組織を削除しました',
    });
  } catch (error) {
    console.error('Delete organization membership error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
