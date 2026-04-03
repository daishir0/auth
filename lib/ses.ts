import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { getSesSettings } from './settings';

/**
 * SESクライアントを取得
 */
async function getSesClient(): Promise<SESClient | null> {
  const settings = await getSesSettings();

  if (!settings.region || !settings.accessKeyId || !settings.secretAccessKey) {
    return null;
  }

  return new SESClient({
    region: settings.region,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  });
}

/**
 * メールを送信
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const settings = await getSesSettings();

  if (!settings.enabled || !settings.fromAddress) {
    console.error('SES is not enabled or from address is not set');
    return false;
  }

  const client = await getSesClient();
  if (!client) {
    console.error('Failed to create SES client');
    return false;
  }

  try {
    const command = new SendEmailCommand({
      Source: settings.fromAddress,
      Destination: {
        ToAddresses: [params.to],
      },
      Message: {
        Subject: {
          Data: params.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: params.html,
            Charset: 'UTF-8',
          },
          ...(params.text && {
            Text: {
              Data: params.text,
              Charset: 'UTF-8',
            },
          }),
        },
      },
    });

    await client.send(command);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

/**
 * メール確認メールを送信
 */
export async function sendVerificationEmail(params: {
  email: string;
  token: string;
  type: 'register' | 'add_password';
}): Promise<boolean> {
  const baseUrl = process.env.OAUTH_ISSUER || 'https://auth.senku.work';
  const verifyUrl = `${baseUrl}/verify-email?token=${params.token}`;

  const isRegister = params.type === 'register';
  const subject = isRegister
    ? '[Auth Service] メールアドレスの確認'
    : '[Auth Service] パスワード設定の確認';

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
    <h1 style="color: #333; font-size: 24px; margin-bottom: 24px; text-align: center;">
      ${isRegister ? 'メールアドレスの確認' : 'パスワード設定の確認'}
    </h1>

    <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      ${isRegister
        ? 'ご登録ありがとうございます。以下のボタンをクリックして、メールアドレスを確認してください。'
        : 'パスワードの設定リクエストを受け付けました。以下のボタンをクリックして、パスワードを設定してください。'}
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${verifyUrl}"
         style="display: inline-block; background-color: #0070f3; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
        ${isRegister ? 'メールアドレスを確認' : 'パスワードを設定'}
      </a>
    </div>

    <p style="color: #999; font-size: 14px; line-height: 1.6; margin-top: 32px;">
      ボタンが機能しない場合は、以下のURLをブラウザに直接貼り付けてください：
    </p>
    <p style="color: #0070f3; font-size: 14px; word-break: break-all;">
      <a href="${verifyUrl}" style="color: #0070f3;">${verifyUrl}</a>
    </p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

    <p style="color: #999; font-size: 12px; line-height: 1.6;">
      このリンクは24時間で期限切れになります。<br>
      このメールに心当たりがない場合は、無視してください。
    </p>

    <p style="color: #999; font-size: 12px; margin-top: 24px;">
      Auth Service
    </p>
  </div>
</body>
</html>
`;

  const text = isRegister
    ? `メールアドレスの確認

ご登録ありがとうございます。以下のURLをクリックして、メールアドレスを確認してください。

${verifyUrl}

このリンクは24時間で期限切れになります。
このメールに心当たりがない場合は、無視してください。

Auth Service`
    : `パスワード設定の確認

パスワードの設定リクエストを受け付けました。以下のURLをクリックして、パスワードを設定してください。

${verifyUrl}

このリンクは24時間で期限切れになります。
このメールに心当たりがない場合は、無視してください。

Auth Service`;

  return sendEmail({
    to: params.email,
    subject,
    html,
    text,
  });
}
