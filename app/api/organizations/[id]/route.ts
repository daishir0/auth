import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { authenticateRequest, hasPermission, forbiddenResponse } from '@/lib/api-auth';

// GET /api/organizations/:id - 組織詳細
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

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
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

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        code: organization.code,
        description: organization.description,
        level: organization.level,
        sortOrder: organization.sortOrder,
        isActive: organization.isActive,
        memberCount: organization._count.memberships,
        parent: organization.parent ? {
          id: organization.parent.id,
          name: organization.parent.name,
          code: organization.parent.code,
        } : null,
        children: organization.children.map(child => ({
          id: child.id,
          name: child.name,
          code: child.code,
          level: child.level,
        })),
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get organization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/organizations/:id - 組織更新
export async function PATCH(
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
    const { name, code, description, parentId, sortOrder, isActive } = body;

    // 存在確認
    const existingOrg = await prisma.organization.findUnique({
      where: { id },
    });

    if (!existingOrg) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // コードの重複チェック
    if (code && code !== existingOrg.code) {
      const codeExists = await prisma.organization.findUnique({
        where: { code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: 'Organization code already exists' },
          { status: 409 }
        );
      }
    }

    // 親組織変更時のレベル更新
    let level = existingOrg.level;
    if (parentId !== undefined && parentId !== existingOrg.parentId) {
      if (parentId === null) {
        level = 0;
      } else {
        // 自分自身を親にはできない
        if (parentId === id) {
          return NextResponse.json(
            { error: 'Cannot set self as parent' },
            { status: 400 }
          );
        }

        const parentOrg = await prisma.organization.findUnique({
          where: { id: parentId },
        });

        if (!parentOrg) {
          return NextResponse.json(
            { error: 'Parent organization not found' },
            { status: 404 }
          );
        }

        level = parentOrg.level + 1;
      }
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(description !== undefined && { description }),
        ...(parentId !== undefined && { parentId }),
        ...(level !== existingOrg.level && { level }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({
      message: 'Organization updated successfully',
      organization: {
        id: organization.id,
        name: organization.name,
        code: organization.code,
        description: organization.description,
        parentId: organization.parentId,
        level: organization.level,
        sortOrder: organization.sortOrder,
        isActive: organization.isActive,
      },
    });
  } catch (error) {
    console.error('Update organization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/:id - 組織削除（論理削除）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    if (!hasPermission(authResult.user, 'organizations:delete')) {
      return forbiddenResponse();
    }

    const { id } = await params;

    // 存在確認
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        children: { where: { isActive: true } },
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

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // 子組織があれば削除不可
    if (organization.children.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete organization with active children' },
        { status: 400 }
      );
    }

    // メンバーがいれば削除不可
    if (organization.memberships.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete organization with active members' },
        { status: 400 }
      );
    }

    // 論理削除
    await prisma.organization.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      message: 'Organization deleted successfully',
    });
  } catch (error) {
    console.error('Delete organization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
