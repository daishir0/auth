import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import {
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  getRefreshTokenExpiryDays,
  getAccessTokenExpiryMinutes,
} from '@/lib/auth';
import {
  exchangeCodeForTokens,
  getGoogleUserInfo,
  getGoogleRedirectUri,
} from '@/lib/google-oauth';
import { isGoogleSsoEnabled } from '@/lib/settings';
import { cleanupExpiredTokens } from '@/lib/token-cleanup';

/**
 * リダイレクトURLの安全性を検証（オープンリダイレクト対策）
 */
function isValidRedirectUrl(url: string, host: string): boolean {
  // 相対パス（/で始まり、//で始まらない）のみ許可
  if (url.startsWith('/') && !url.startsWith('//')) {
    return true;
  }

  try {
    const parsed = new URL(url);
    // 同一ホストのみ許可
    return parsed.host === host;
  } catch {
    return false;
  }
}

/**
 * GET /api/auth/google/callback
 * GoogleからのOAuthコールバック処理
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  try {
    // Google SSOが有効か確認
    const enabled = await isGoogleSsoEnabled();
    if (!enabled) {
      return redirectToError('Google SSO is not enabled');
    }

    // クエリパラメータ取得
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    // エラーチェック
    if (error) {
      console.error('Google OAuth error:', error);
      return redirectToError('認証がキャンセルされました');
    }

    if (!code) {
      return redirectToError('認証コードがありません');
    }

    // State検証（CSRF対策）
    const savedState = cookieStore.get('google_oauth_state')?.value;
    if (!state || state !== savedState) {
      console.error('State mismatch:', { received: state, saved: savedState });
      return redirectToError('セッションが無効です。もう一度お試しください');
    }

    // 最終リダイレクト先を取得・検証（オープンリダイレクト対策）
    const host = request.headers.get('host') || '';
    const rawRedirect = cookieStore.get('google_oauth_redirect')?.value || '/dashboard';
    const finalRedirect = isValidRedirectUrl(rawRedirect, host) ? rawRedirect : '/dashboard';

    // Cookie削除
    cookieStore.delete('google_oauth_state');
    cookieStore.delete('google_oauth_redirect');

    // ベースURL取得
    const baseUrl = `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}`;
    const redirectUri = getGoogleRedirectUri(baseUrl);

    // トークン交換
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens) {
      return redirectToError('トークンの取得に失敗しました');
    }

    // ユーザー情報取得
    const googleUser = await getGoogleUserInfo(tokens.access_token);
    if (!googleUser || !googleUser.email) {
      return redirectToError('ユーザー情報の取得に失敗しました');
    }

    // メールが確認済みか確認
    if (!googleUser.email_verified) {
      return redirectToError('メールアドレスが確認されていません');
    }

    // 既存ユーザーを検索（メールまたはgoogleIdで）
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: googleUser.email },
          { credential: { googleId: googleUser.sub } },
        ],
      },
      include: {
        credential: true,
        profile: true,
        globalRoles: {
          include: { role: true },
          where: {
            OR: [
              { validTo: null },
              { validTo: { gt: new Date() } },
            ],
          },
        },
      },
    });

    if (user) {
      // 既存ユーザー: googleIdが未設定なら設定（自動リンク）
      if (!user.credential?.googleId) {
        await prisma.userCredential.update({
          where: { userId: user.id },
          data: { googleId: googleUser.sub },
        });
      }

      // GoogleでログインしたユーザーはemailVerifiedをtrueに設定
      if (!user.emailVerified) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        });
      }

      // アカウントがアクティブか確認
      if (!user.isActive) {
        return redirectToError('アカウントが無効化されています');
      }

      // Note: アバターURLはGoogle SSOで上書きしない（ユーザー設定を尊重）
    } else {
      // 新規ユーザー作成
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          emailVerified: true, // Googleはメールアドレスをverifyしているためtrue
          isActive: true,
          credential: {
            create: {
              hashedPassword: null, // パスワードなし（Google専用）
              googleId: googleUser.sub,
            },
          },
          profile: {
            create: {
              displayName: googleUser.name || null,
              firstName: googleUser.given_name || null,
              lastName: googleUser.family_name || null,
              // avatarUrl は設定しない（ユーザーが自分で設定）
            },
          },
        },
        include: {
          credential: true,
          profile: true,
          globalRoles: {
            include: { role: true },
          },
        },
      });
    }

    // ロール名配列を取得
    const roles = user.globalRoles.map((ur) => ur.role.name);

    // トークン生成
    const accessToken = await generateAccessToken({
      userId: user.id,
      email: user.email,
      roles,
    });

    const refreshToken = generateRefreshToken();
    const [refreshTokenExpiry, accessTokenExpiryMinutes, refreshTokenExpiryDays] = await Promise.all([
      getRefreshTokenExpiry(),
      getAccessTokenExpiryMinutes(),
      getRefreshTokenExpiryDays(),
    ]);

    // リフレッシュトークンをDBに保存
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshTokenExpiry,
      },
    });

    // セキュリティログ & 最終ログイン日時を更新
    await Promise.all([
      prisma.securityLog.create({
        data: {
          userId: user.id,
          action: 'login_success_google',
          ipAddress:
            request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip'),
          userAgent: request.headers.get('user-agent'),
          details: { provider: 'google' },
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    // 期限切れトークンのクリーンアップ（バックグラウンドで実行、レスポンスをブロックしない）
    cleanupExpiredTokens().catch(console.error);

    // Cookieに設定
    cookieStore.set('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: accessTokenExpiryMinutes * 60,
      path: '/',
    });

    cookieStore.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: refreshTokenExpiryDays * 24 * 60 * 60,
      path: '/',
    });

    // 最終リダイレクト
    return NextResponse.redirect(new URL(finalRedirect, baseUrl));
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return redirectToError('認証処理中にエラーが発生しました');
  }
}

function redirectToError(message: string): NextResponse {
  const errorUrl = `/oauth/error?error=${encodeURIComponent(message)}&provider=google`;
  return NextResponse.redirect(
    new URL(errorUrl, process.env.NEXT_PUBLIC_APP_URL || 'https://auth.senku.work')
  );
}
