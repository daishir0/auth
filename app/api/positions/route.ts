import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { authenticateRequest, hasPermission, forbiddenResponse } from '@/lib/api-auth';

// GET /api/positions - 役職一覧
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    if (!hasPermission(authResult.user, 'positions:read')) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where = includeInactive ? {} : { isActive: true };

    const positions = await prisma.position.findMany({
      where,
      orderBy: { level: 'desc' },
    });

    return NextResponse.json({
      positions: positions.map(pos => ({
        id: pos.id,
        name: pos.name,
        code: pos.code,
        level: pos.level,
        description: pos.description,
        isActive: pos.isActive,
        createdAt: pos.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get positions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/positions - 役職作成
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) return authResult.error;

    if (!hasPermission(authResult.user, 'positions:write')) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const { name, code, level, description } = body;

    // バリデーション
    if (!name || !code) {
      return NextResponse.json(
        { error: 'Name and code are required' },
        { status: 400 }
      );
    }

    // コードの重複チェック
    const existingPos = await prisma.position.findUnique({
      where: { code },
    });

    if (existingPos) {
      return NextResponse.json(
        { error: 'Position code already exists' },
        { status: 409 }
      );
    }

    const position = await prisma.position.create({
      data: {
        name,
        code,
        level: level || 0,
        description,
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        message: 'Position created successfully',
        position: {
          id: position.id,
          name: position.name,
          code: position.code,
          level: position.level,
          description: position.description,
          isActive: position.isActive,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create position error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
