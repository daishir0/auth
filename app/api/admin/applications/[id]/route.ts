import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';
import prisma from '@/lib/db';

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

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: アプリケーション詳細取得
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await getAuthenticatedUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const hasPermission = currentUser.roles.includes('super_admin') ||
                          currentUser.roles.includes('admin');
    if (!hasPermission) {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const application = await prisma.oAuthClient.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        name: true,
        description: true,
        appUrl: true,
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
    });

    if (!application) {
      return NextResponse.json(
        { error: 'アプリケーションが見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: application.id,
      clientId: application.clientId,
      name: application.name,
      description: application.description,
      appUrl: application.appUrl,
      redirectUris: application.redirectUris,
      scopes: application.scopes,
      grantTypes: application.grantTypes,
      isActive: application.isActive,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      activeTokens: application._count.refreshTokens,
    });
  } catch (error) {
    console.error('Application detail error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// PATCH: アプリケーション更新
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await getAuthenticatedUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const hasPermission = currentUser.roles.includes('super_admin') ||
                          currentUser.roles.includes('admin');
    if (!hasPermission) {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, appUrl, redirectUris, scopes, grantTypes, isActive } = body;

    // アプリケーションの存在確認
    const existing = await prisma.oAuthClient.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'アプリケーションが見つかりません' },
        { status: 404 }
      );
    }

    // バリデーション
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return NextResponse.json(
        { error: 'アプリケーション名は空にできません' },
        { status: 400 }
      );
    }

    if (redirectUris !== undefined) {
      if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
        return NextResponse.json(
          { error: 'リダイレクトURIを少なくとも1つ指定してください' },
          { status: 400 }
        );
      }

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
    }

    // 更新データの構築
    const updateData: {
      name?: string;
      description?: string | null;
      appUrl?: string | null;
      redirectUris?: string[];
      scopes?: string[];
      grantTypes?: string[];
      isActive?: boolean;
    } = {};

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (appUrl !== undefined) updateData.appUrl = appUrl?.trim() || null;
    if (redirectUris !== undefined) updateData.redirectUris = redirectUris;
    if (scopes !== undefined) updateData.scopes = scopes;
    if (grantTypes !== undefined) updateData.grantTypes = grantTypes;
    if (isActive !== undefined) updateData.isActive = isActive;

    const application = await prisma.oAuthClient.update({
      where: { id },
      data: updateData,
    });

    // 監査ログを記録
    await prisma.securityLog.create({
      data: {
        userId: currentUser.userId,
        action: 'oauth_client_updated',
        details: {
          clientId: application.clientId,
          changes: Object.keys(updateData),
        },
      },
    });

    return NextResponse.json({
      id: application.id,
      clientId: application.clientId,
      name: application.name,
      description: application.description,
      appUrl: application.appUrl,
      redirectUris: application.redirectUris,
      scopes: application.scopes,
      grantTypes: application.grantTypes,
      isActive: application.isActive,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    });
  } catch (error) {
    console.error('Application update error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// DELETE: アプリケーション削除
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await getAuthenticatedUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const hasPermission = currentUser.roles.includes('super_admin') ||
                          currentUser.roles.includes('admin');
    if (!hasPermission) {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // アプリケーションの存在確認
    const existing = await prisma.oAuthClient.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        name: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'アプリケーションが見つかりません' },
        { status: 404 }
      );
    }

    // 関連するトークンとコードはCascadeで自動削除される
    await prisma.oAuthClient.delete({
      where: { id },
    });

    // 監査ログを記録
    await prisma.securityLog.create({
      data: {
        userId: currentUser.userId,
        action: 'oauth_client_deleted',
        details: {
          clientId: existing.clientId,
          name: existing.name,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Application delete error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
