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
