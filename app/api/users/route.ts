import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { authenticateRequest, hasPermission, forbiddenResponse } from '@/lib/api-auth';

// GET /api/users - ユーザー一覧
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    if (!hasPermission(authResult.user, 'users:read')) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const organizationId = searchParams.get('organizationId');
    const roleId = searchParams.get('roleId');
    const isActive = searchParams.get('isActive');

    const skip = (page - 1) * limit;

    // 検索条件
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { displayName: { contains: search, mode: 'insensitive' } } },
        { profile: { firstName: { contains: search, mode: 'insensitive' } } },
        { profile: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (organizationId) {
      where.organizationMemberships = {
        some: {
          organizationId,
          OR: [
            { endDate: null },
            { endDate: { gt: new Date() } },
          ],
        },
      };
    }

    if (roleId) {
      where.globalRoles = {
        some: {
          roleId,
          OR: [
            { validTo: null },
            { validTo: { gt: new Date() } },
          ],
        },
      };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
              isPrimary: true,
              OR: [
                { endDate: null },
                { endDate: { gt: new Date() } },
              ],
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        profile: user.profile ? {
          displayName: user.profile.displayName,
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          avatarUrl: user.profile.avatarUrl,
        } : null,
        roles: user.globalRoles.map(ur => ({
          id: ur.role.id,
          name: ur.role.name,
          displayName: ur.role.displayName,
        })),
        primaryOrganization: user.organizationMemberships[0] ? {
          id: user.organizationMemberships[0].organization.id,
          name: user.organizationMemberships[0].organization.name,
          position: user.organizationMemberships[0].position?.name,
        } : null,
        createdAt: user.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/users - ユーザー作成
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    if (!hasPermission(authResult.user, 'users:write')) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const {
      email,
      password,
      displayName,
      firstName,
      lastName,
      phone,
      hireDate,
      roleIds,
      organizationId,
      positionId,
    } = body;

    // バリデーション
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // メールアドレスの重複チェック
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // パスワードをハッシュ化
    const hashedPassword = await hashPassword(password);

    // デフォルトロールを取得（指定がなければuser）
    let rolesToAssign: string[] = roleIds || [];
    if (rolesToAssign.length === 0) {
      const userRole = await prisma.globalRole.findUnique({
        where: { name: 'user' },
      });
      if (userRole) {
        rolesToAssign = [userRole.id];
      }
    }

    // ユーザー作成
    const user = await prisma.user.create({
      data: {
        email,
        isActive: true,
        credential: {
          create: {
            hashedPassword,
          },
        },
        profile: {
          create: {
            displayName: displayName || email.split('@')[0],
            firstName,
            lastName,
            phone,
            hireDate: hireDate ? new Date(hireDate) : undefined,
          },
        },
        globalRoles: {
          createMany: {
            data: rolesToAssign.map((roleId: string) => ({ roleId })),
          },
        },
        ...(organizationId && {
          organizationMemberships: {
            create: {
              organizationId,
              positionId,
              isPrimary: true,
            },
          },
        }),
      },
      include: {
        profile: true,
        globalRoles: {
          include: {
            role: true,
          },
        },
        organizationMemberships: {
          include: {
            organization: true,
            position: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          id: user.id,
          email: user.email,
          isActive: user.isActive,
          profile: user.profile,
          roles: user.globalRoles.map(ur => ur.role),
          organizations: user.organizationMemberships.map(om => ({
            ...om.organization,
            position: om.position,
            isPrimary: om.isPrimary,
          })),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
