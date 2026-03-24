import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { authenticateRequest, hasPermission, forbiddenResponse } from '@/lib/api-auth';

// GET /api/organizations - 組織一覧
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    if (!hasPermission(authResult.user, 'organizations:read')) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parentId');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const flat = searchParams.get('flat') === 'true';

    const where: Record<string, unknown> = {};

    if (!includeInactive) {
      where.isActive = true;
    }

    if (parentId) {
      where.parentId = parentId;
    } else if (!flat) {
      // ルート組織のみ取得
      where.parentId = null;
    }

    const organizations = await prisma.organization.findMany({
      where,
      include: {
        children: {
          where: includeInactive ? {} : { isActive: true },
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
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({
      organizations: organizations.map(org => ({
        id: org.id,
        name: org.name,
        code: org.code,
        description: org.description,
        parentId: org.parentId,
        level: org.level,
        sortOrder: org.sortOrder,
        isActive: org.isActive,
        memberCount: org._count.memberships,
        children: org.children.map(child => ({
          id: child.id,
          name: child.name,
          code: child.code,
          level: child.level,
        })),
        createdAt: org.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/organizations - 組織作成
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    if (!hasPermission(authResult.user, 'organizations:write')) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const { name, code, description, parentId, sortOrder } = body;

    // バリデーション
    if (!name || !code) {
      return NextResponse.json(
        { error: 'Name and code are required' },
        { status: 400 }
      );
    }

    // コードの重複チェック
    const existingOrg = await prisma.organization.findUnique({
      where: { code },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: 'Organization code already exists' },
        { status: 409 }
      );
    }

    // 親組織の存在確認とレベル計算
    let level = 0;
    if (parentId) {
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

    const organization = await prisma.organization.create({
      data: {
        name,
        code,
        description,
        parentId,
        level,
        sortOrder: sortOrder || 0,
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        message: 'Organization created successfully',
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
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create organization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
