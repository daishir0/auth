import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { authenticateRequest, hasPermission, forbiddenResponse } from '@/lib/api-auth';

// DELETE /api/organizations/:id/members/:userId - メンバー削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    if (!hasPermission(authResult.user, 'organizations:write')) {
      return forbiddenResponse();
    }

    const { id, userId } = await params;

    // メンバーシップ検索
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Membership not found' },
        { status: 404 }
      );
    }

    // 終了日を設定（論理削除）
    await prisma.organizationMembership.update({
      where: { id: membership.id },
      data: { endDate: new Date() },
    });

    return NextResponse.json({
      message: 'Member removed successfully',
    });
  } catch (error) {
    console.error('Remove organization member error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/organizations/:id/members/:userId - メンバー更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    if (!hasPermission(authResult.user, 'organizations:write')) {
      return forbiddenResponse();
    }

    const { id, userId } = await params;
    const body = await request.json();
    const { positionId, isPrimary } = body;

    // メンバーシップ検索
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Membership not found' },
        { status: 404 }
      );
    }

    // 主所属に設定する場合、他の主所属を解除
    if (isPrimary) {
      await prisma.organizationMembership.updateMany({
        where: {
          userId,
          isPrimary: true,
          id: { not: membership.id },
          OR: [
            { endDate: null },
            { endDate: { gt: new Date() } },
          ],
        },
        data: { isPrimary: false },
      });
    }

    const updated = await prisma.organizationMembership.update({
      where: { id: membership.id },
      data: {
        ...(positionId !== undefined && { positionId }),
        ...(isPrimary !== undefined && { isPrimary }),
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

    return NextResponse.json({
      message: 'Membership updated successfully',
      membership: {
        id: updated.id,
        user: {
          id: updated.user.id,
          email: updated.user.email,
          displayName: updated.user.profile?.displayName,
        },
        position: updated.position,
        isPrimary: updated.isPrimary,
      },
    });
  } catch (error) {
    console.error('Update organization member error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
