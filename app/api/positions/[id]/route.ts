import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { authenticateRequest, hasPermission, forbiddenResponse } from '@/lib/api-auth';

// GET /api/positions/:id - 役職詳細
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    if (!hasPermission(authResult.user, 'positions:read')) {
      return forbiddenResponse();
    }

    const { id } = await params;

    const position = await prisma.position.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            memberships: {
              where: {
                OR: [
                  { endDate: null },
                  { endDate: { gt: new Date() } },
                ],
              },
            },
          },
        },
      },
    });

    if (!position) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      position: {
        id: position.id,
        name: position.name,
        code: position.code,
        level: position.level,
        description: position.description,
        isActive: position.isActive,
        memberCount: position._count.memberships,
        createdAt: position.createdAt,
        updatedAt: position.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get position error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/positions/:id - 役職更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    if (!hasPermission(authResult.user, 'positions:write')) {
      return forbiddenResponse();
    }

    const { id } = await params;
    const body = await request.json();
    const { name, code, level, description, isActive } = body;

    // 存在確認
    const existingPos = await prisma.position.findUnique({
      where: { id },
    });

    if (!existingPos) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      );
    }

    // コードの重複チェック
    if (code && code !== existingPos.code) {
      const codeExists = await prisma.position.findUnique({
        where: { code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: 'Position code already exists' },
          { status: 409 }
        );
      }
    }

    const position = await prisma.position.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(level !== undefined && { level }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({
      message: 'Position updated successfully',
      position: {
        id: position.id,
        name: position.name,
        code: position.code,
        level: position.level,
        description: position.description,
        isActive: position.isActive,
      },
    });
  } catch (error) {
    console.error('Update position error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/positions/:id - 役職削除（論理削除）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    if (!hasPermission(authResult.user, 'positions:delete')) {
      return forbiddenResponse();
    }

    const { id } = await params;

    // 存在確認
    const position = await prisma.position.findUnique({
      where: { id },
      include: {
        memberships: {
          where: {
            OR: [
              { endDate: null },
              { endDate: { gt: new Date() } },
            ],
          },
        },
      },
    });

    if (!position) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      );
    }

    // 使用中の場合は削除不可
    if (position.memberships.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete position that is in use' },
        { status: 400 }
      );
    }

    // 論理削除
    await prisma.position.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      message: 'Position deleted successfully',
    });
  } catch (error) {
    console.error('Delete position error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
