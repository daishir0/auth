import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { authenticateRequest, hasPermission, forbiddenResponse } from '@/lib/api-auth';

// GET /api/users/:id - ユーザー詳細
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

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        globalRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
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
          orderBy: [
            { isPrimary: 'desc' },
            { startDate: 'desc' },
          ],
        },
        idMappings: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 権限の集約
    const permissions = new Set<string>();
    for (const userRole of user.globalRoles) {
      for (const rolePermission of userRole.role.permissions) {
        permissions.add(rolePermission.permission.name);
      }
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
          metadata: user.profile.metadata,
        } : null,
        roles: user.globalRoles.map(ur => ({
          id: ur.role.id,
          name: ur.role.name,
          displayName: ur.role.displayName,
          validFrom: ur.validFrom,
          validTo: ur.validTo,
        })),
        permissions: Array.from(permissions),
        organizations: user.organizationMemberships.map(om => ({
          id: om.organization.id,
          name: om.organization.name,
          code: om.organization.code,
          isPrimary: om.isPrimary,
          startDate: om.startDate,
          endDate: om.endDate,
          position: om.position ? {
            id: om.position.id,
            name: om.position.name,
            code: om.position.code,
            level: om.position.level,
          } : null,
        })),
        idMappings: user.idMappings.map(m => ({
          legacyId: m.legacyId,
          sourceSystem: m.sourceSystem,
        })),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/users/:id - ユーザー更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    const { id } = await params;

    // 自分自身の情報は更新可能、それ以外はusers:write権限が必要
    const isSelf = authResult.user.userId === id;
    if (!isSelf && !hasPermission(authResult.user, 'users:write')) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const { email, isActive, roleIds } = body;

    // 存在確認
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 自分自身の場合、isActiveとroleIdsの変更は不可
    if (isSelf && (isActive !== undefined || roleIds !== undefined)) {
      return NextResponse.json(
        { error: 'Cannot change your own active status or roles' },
        { status: 400 }
      );
    }

    // メールアドレスの重複チェック
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      });
      if (emailExists) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 409 }
        );
      }
    }

    // トランザクションで更新
    const updatedUser = await prisma.$transaction(async (tx) => {
      // ユーザー基本情報更新
      const user = await tx.user.update({
        where: { id },
        data: {
          ...(email && { email }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      // ロール更新（指定された場合）
      if (roleIds && Array.isArray(roleIds)) {
        // 既存のロールを無効化
        await tx.userGlobalRole.updateMany({
          where: {
            userId: id,
            validTo: null,
          },
          data: {
            validTo: new Date(),
          },
        });

        // 新しいロールを追加
        for (const roleId of roleIds) {
          await tx.userGlobalRole.create({
            data: {
              userId: id,
              roleId,
            },
          });
        }
      }

      return user;
    });

    // 更新後のユーザー情報を取得
    const user = await prisma.user.findUnique({
      where: { id: updatedUser.id },
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
      },
    });

    return NextResponse.json({
      message: 'User updated successfully',
      user: {
        id: user!.id,
        email: user!.email,
        isActive: user!.isActive,
        profile: user!.profile,
        roles: user!.globalRoles.map(ur => ur.role),
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/:id - ユーザー削除（論理削除）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    if (!hasPermission(authResult.user, 'users:delete')) {
      return forbiddenResponse();
    }

    const { id } = await params;

    // 自分自身は削除不可
    if (authResult.user.userId === id) {
      return NextResponse.json(
        { error: 'Cannot delete yourself' },
        { status: 400 }
      );
    }

    // 存在確認
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 論理削除
    await prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
