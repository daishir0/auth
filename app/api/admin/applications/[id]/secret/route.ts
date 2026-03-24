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

function generateClientSecret(): string {
  return randomBytes(32).toString('hex');
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST: シークレット再生成
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // 新しいシークレットを生成
    const newSecret = generateClientSecret();
    const hashedSecret = hashClientSecret(newSecret);

    // シークレットを更新
    await prisma.oAuthClient.update({
      where: { id },
      data: {
        clientSecret: hashedSecret,
      },
    });

    // 監査ログを記録
    await prisma.securityLog.create({
      data: {
        userId: currentUser.userId,
        action: 'oauth_client_secret_regenerated',
        details: {
          clientId: existing.clientId,
          name: existing.name,
        },
      },
    });

    return NextResponse.json({
      clientSecret: newSecret, // 再生成時のみ平文で返却
      message: 'シークレットを再生成しました。この値は再度表示されません。',
    });
  } catch (error) {
    console.error('Secret regenerate error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
