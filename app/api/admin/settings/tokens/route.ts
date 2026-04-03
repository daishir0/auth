import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';
import { getTokenSettings, setTokenSettings, TOKEN_DEFAULTS } from '@/lib/settings';

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

/**
 * GET /api/admin/settings/tokens
 * トークン期限設定を取得
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // super_adminのみアクセス可能
    if (!currentUser.roles.includes('super_admin')) {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    const settings = await getTokenSettings();

    return NextResponse.json({
      settings,
      defaults: TOKEN_DEFAULTS,
    });
  } catch (error) {
    console.error('Get token settings error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/settings/tokens
 * トークン期限設定を更新
 */
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // super_adminのみアクセス可能
    if (!currentUser.roles.includes('super_admin')) {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { accessTokenExpiresMinutes, refreshTokenExpiresDays } = body;

    // バリデーション
    if (
      typeof accessTokenExpiresMinutes !== 'number' ||
      accessTokenExpiresMinutes < 1 ||
      accessTokenExpiresMinutes > 60
    ) {
      return NextResponse.json(
        { error: 'アクセストークン有効期限は1〜60分で指定してください' },
        { status: 400 }
      );
    }

    if (
      typeof refreshTokenExpiresDays !== 'number' ||
      refreshTokenExpiresDays < 1 ||
      refreshTokenExpiresDays > 365
    ) {
      return NextResponse.json(
        { error: 'リフレッシュトークン有効期限は1〜365日で指定してください' },
        { status: 400 }
      );
    }

    await setTokenSettings({
      accessTokenExpiresMinutes,
      refreshTokenExpiresDays,
    });

    const updatedSettings = await getTokenSettings();

    return NextResponse.json({
      message: '設定を更新しました',
      settings: updatedSettings,
    });
  } catch (error) {
    console.error('Update token settings error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
