import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

// GET: 現在のユーザーがアクセス可能なアプリケーション一覧
export async function GET(request: NextRequest) {
  try {
    // Authorizationヘッダーまたはクッキーからトークン取得
    const authHeader = request.headers.get('authorization');
    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      const cookieStore = await cookies();
      token = cookieStore.get('access_token')?.value;
    }

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    const payload = await verifyAccessToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // ユーザーがアクセス可能なアプリケーション一覧を取得
    const accessList = await prisma.userApplicationAccess.findMany({
      where: { userId: payload.userId },
      include: {
        application: {
          select: {
            id: true,
            clientId: true,
            name: true,
            description: true,
            appUrl: true,
            iconUrl: true,
            isActive: true,
          },
        },
      },
      orderBy: { application: { name: 'asc' } },
    });

    // アクティブなアプリのみフィルタリング
    const applications = accessList
      .filter((access) => access.application.isActive)
      .map((access) => ({
        id: access.application.id,
        clientId: access.application.clientId,
        name: access.application.name,
        description: access.application.description,
        appUrl: access.application.appUrl,
        iconUrl: access.application.iconUrl,
        grantedAt: access.grantedAt,
      }));

    return NextResponse.json({
      applications,
      count: applications.length,
    });
  } catch (error) {
    console.error('My applications error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
