import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { createHash, randomBytes } from 'crypto';

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get('access_token')?.value;
  }

  if (!token) {
    return null;
  }

  return await verifyAccessToken(token);
}

function hashClientSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function generateClientId(): string {
  return randomBytes(16).toString('hex');
}

function generateClientSecret(): string {
  return randomBytes(32).toString('hex');
}

// GET: アプリケーション一覧取得
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // clients:read権限のチェック
    const hasPermission = currentUser.roles.includes('super_admin') ||
                          currentUser.roles.includes('admin');
    if (!hasPermission) {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    const skip = (page - 1) * limit;

    const where: {
      name?: { contains: string; mode: 'insensitive' };
      isActive?: boolean;
    } = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    const [applications, total] = await Promise.all([
      prisma.oAuthClient.findMany({
        where,
        select: {
          id: true,
          clientId: true,
          name: true,
          description: true,
          redirectUris: true,
          scopes: true,
          grantTypes: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              refreshTokens: {
                where: {
                  expiresAt: { gt: new Date() },
                },
              },
              authorizationCodes: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.oAuthClient.count({ where }),
    ]);

    return NextResponse.json({
      applications: applications.map((app) => ({
        id: app.id,
        clientId: app.clientId,
        name: app.name,
        description: app.description,
        redirectUris: app.redirectUris,
        scopes: app.scopes,
        grantTypes: app.grantTypes,
        isActive: app.isActive,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        activeTokens: app._count.refreshTokens,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Applications list error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// POST: 新規アプリケーション作成
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // clients:write権限のチェック
    const hasPermission = currentUser.roles.includes('super_admin') ||
                          currentUser.roles.includes('admin');
    if (!hasPermission) {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, redirectUris, scopes, grantTypes } = body;

    // バリデーション
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'アプリケーション名は必須です' },
        { status: 400 }
      );
    }

    if (!redirectUris || !Array.isArray(redirectUris) || redirectUris.length === 0) {
      return NextResponse.json(
        { error: 'リダイレクトURIを少なくとも1つ指定してください' },
        { status: 400 }
      );
    }

    // URLの形式チェック
    for (const uri of redirectUris) {
      try {
        new URL(uri);
      } catch {
        return NextResponse.json(
          { error: `無効なリダイレクトURI: ${uri}` },
          { status: 400 }
        );
      }
    }

    // クライアント認証情報を生成
    const clientId = generateClientId();
    const clientSecret = generateClientSecret();
    const hashedSecret = hashClientSecret(clientSecret);

    // デフォルト値の設定
    const defaultScopes = ['openid', 'profile', 'email'];
    const defaultGrantTypes = ['authorization_code', 'refresh_token'];

    const application = await prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecret: hashedSecret,
        name: name.trim(),
        description: description?.trim() || null,
        redirectUris,
        scopes: scopes && Array.isArray(scopes) ? scopes : defaultScopes,
        grantTypes: grantTypes && Array.isArray(grantTypes) ? grantTypes : defaultGrantTypes,
        isActive: true,
      },
    });

    // 監査ログを記録
    await prisma.securityLog.create({
      data: {
        userId: currentUser.userId,
        action: 'oauth_client_created',
        details: {
          clientId: application.clientId,
          name: application.name,
        },
      },
    });

    return NextResponse.json({
      id: application.id,
      clientId: application.clientId,
      clientSecret, // 作成時のみ平文で返却
      name: application.name,
      description: application.description,
      redirectUris: application.redirectUris,
      scopes: application.scopes,
      grantTypes: application.grantTypes,
      isActive: application.isActive,
      createdAt: application.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Application create error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
