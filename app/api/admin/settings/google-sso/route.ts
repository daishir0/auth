import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, hasPermission, forbiddenResponse } from '@/lib/api-auth';
import { getGoogleSsoSettings, setGoogleSsoSettings, SETTINGS_KEYS, getSetting } from '@/lib/settings';

/**
 * GET /api/admin/settings/google-sso
 * Google SSO設定を取得
 */
export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if ('error' in authResult) {
    return authResult.error;
  }

  // system:admin権限のみ許可
  if (!hasPermission(authResult.user, 'system:admin')) {
    return forbiddenResponse('システム設定へのアクセス権がありません');
  }

  try {
    const settings = await getGoogleSsoSettings();

    // Client Secretは存在するかどうかのみ返す（セキュリティ上）
    return NextResponse.json({
      enabled: settings.enabled,
      clientId: settings.clientId || '',
      hasClientSecret: !!settings.clientSecret,
    });
  } catch (error) {
    console.error('Failed to get Google SSO settings:', error);
    return NextResponse.json(
      { error: '設定の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/settings/google-sso
 * Google SSO設定を保存
 */
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if ('error' in authResult) {
    return authResult.error;
  }

  if (!hasPermission(authResult.user, 'system:admin')) {
    return forbiddenResponse('システム設定へのアクセス権がありません');
  }

  try {
    const body = await request.json();
    const { enabled, clientId, clientSecret } = body;

    // バリデーション
    if (enabled && !clientId) {
      return NextResponse.json(
        { error: 'Client IDは必須です' },
        { status: 400 }
      );
    }

    // 有効化時にClient Secretがない場合、既存の設定を確認
    if (enabled && !clientSecret) {
      const existingSecret = await getSetting(SETTINGS_KEYS.GOOGLE_SSO_CLIENT_SECRET);
      if (!existingSecret) {
        return NextResponse.json(
          { error: 'Client Secretは必須です' },
          { status: 400 }
        );
      }
    }

    await setGoogleSsoSettings({
      enabled: !!enabled,
      clientId: clientId || '',
      clientSecret: clientSecret || undefined,
    });

    return NextResponse.json({
      message: '設定を保存しました',
      enabled: !!enabled,
    });
  } catch (error) {
    console.error('Failed to save Google SSO settings:', error);
    return NextResponse.json(
      { error: '設定の保存に失敗しました' },
      { status: 500 }
    );
  }
}
