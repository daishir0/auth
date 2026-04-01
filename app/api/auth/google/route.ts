import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getGoogleAuthUrl, generateState, getGoogleRedirectUri } from '@/lib/google-oauth';
import { isGoogleSsoEnabled } from '@/lib/settings';

/**
 * GET /api/auth/google
 * Google OAuth認証を開始（認可URLへリダイレクト）
 */
export async function GET(request: NextRequest) {
  try {
    // Google SSOが有効か確認
    const enabled = await isGoogleSsoEnabled();
    if (!enabled) {
      return NextResponse.json(
        { error: 'Google SSO is not enabled' },
        { status: 400 }
      );
    }

    // ベースURL取得
    const baseUrl = `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}`;
    const redirectUri = getGoogleRedirectUri(baseUrl);

    // ログイン後のリダイレクト先を取得
    const finalRedirect = request.nextUrl.searchParams.get('redirect') || '/dashboard';

    // CSRF対策用state生成
    const state = generateState();

    // Google認可URLを生成
    const authUrl = await getGoogleAuthUrl(redirectUri, state);
    if (!authUrl) {
      return NextResponse.json(
        { error: 'Failed to generate Google auth URL' },
        { status: 500 }
      );
    }

    // stateとfinalRedirectをcookieに保存（callback時に検証）
    const cookieStore = await cookies();
    cookieStore.set('google_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10分
      path: '/',
    });
    cookieStore.set('google_oauth_redirect', finalRedirect, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10分
      path: '/',
    });

    // Google認可画面へリダイレクト
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Google OAuth start error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
