import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, hasPermission, forbiddenResponse } from '@/lib/api-auth';
import { getSesSettings, setSesSettings, SETTINGS_KEYS, getSetting } from '@/lib/settings';

/**
 * GET /api/admin/settings/ses
 * Amazon SES設定を取得
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
    const settings = await getSesSettings();

    // Secret Access Keyは存在するかどうかのみ返す（セキュリティ上）
    return NextResponse.json({
      enabled: settings.enabled,
      region: settings.region || 'ap-northeast-1',
      accessKeyId: settings.accessKeyId || '',
      hasSecretAccessKey: !!settings.secretAccessKey,
      fromAddress: settings.fromAddress || '',
    });
  } catch (error) {
    console.error('Failed to get SES settings:', error);
    return NextResponse.json(
      { error: '設定の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/settings/ses
 * Amazon SES設定を保存
 */
export async function PUT(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if ('error' in authResult) {
    return authResult.error;
  }

  if (!hasPermission(authResult.user, 'system:admin')) {
    return forbiddenResponse('システム設定へのアクセス権がありません');
  }

  try {
    const body = await request.json();
    const { enabled, region, accessKeyId, secretAccessKey, fromAddress } = body;

    // バリデーション
    if (enabled) {
      if (!region) {
        return NextResponse.json(
          { error: 'リージョンは必須です' },
          { status: 400 }
        );
      }
      if (!accessKeyId) {
        return NextResponse.json(
          { error: 'Access Key IDは必須です' },
          { status: 400 }
        );
      }
      if (!fromAddress) {
        return NextResponse.json(
          { error: '送信元メールアドレスは必須です' },
          { status: 400 }
        );
      }

      // 有効化時にSecret Access Keyがない場合、既存の設定を確認
      if (!secretAccessKey) {
        const existingSecret = await getSetting(SETTINGS_KEYS.SES_SECRET_ACCESS_KEY);
        if (!existingSecret) {
          return NextResponse.json(
            { error: 'Secret Access Keyは必須です' },
            { status: 400 }
          );
        }
      }
    }

    await setSesSettings({
      enabled: !!enabled,
      region: region || 'ap-northeast-1',
      accessKeyId: accessKeyId || '',
      secretAccessKey: secretAccessKey || undefined,
      fromAddress: fromAddress || '',
    });

    return NextResponse.json({
      message: '設定を保存しました',
      enabled: !!enabled,
    });
  } catch (error) {
    console.error('Failed to save SES settings:', error);
    return NextResponse.json(
      { error: '設定の保存に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/settings/ses
 * テストメール送信
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
    const { testEmail } = body;

    if (!testEmail) {
      return NextResponse.json(
        { error: '送信先メールアドレスは必須です' },
        { status: 400 }
      );
    }

    // SES設定を取得
    const settings = await getSesSettings();
    if (!settings.enabled || !settings.region || !settings.accessKeyId || !settings.secretAccessKey || !settings.fromAddress) {
      return NextResponse.json(
        { error: 'SES設定が完了していません' },
        { status: 400 }
      );
    }

    // テストメール送信
    const { sendEmail } = await import('@/lib/ses');
    const success = await sendEmail({
      to: testEmail,
      subject: '[Auth Service] テストメール',
      html: `
        <h2>テストメール</h2>
        <p>これはAmazon SESの設定確認用テストメールです。</p>
        <p>このメールが届いていれば、SES設定は正常に動作しています。</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          Auth Service - ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
        </p>
      `,
      text: 'これはAmazon SESの設定確認用テストメールです。このメールが届いていれば、SES設定は正常に動作しています。',
    });

    if (success) {
      return NextResponse.json({
        message: `テストメールを ${testEmail} に送信しました`,
      });
    } else {
      return NextResponse.json(
        { error: 'メール送信に失敗しました' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Failed to send test email:', error);
    return NextResponse.json(
      { error: `メール送信に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
