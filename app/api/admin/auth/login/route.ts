import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import {
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  getRefreshTokenExpiryDays,
  getAccessTokenExpiryMinutes,
} from '@/lib/auth';
import { cleanupExpiredTokens } from '@/lib/token-cleanup';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // バリデーション
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // ユーザー検索（認証情報とロール含む）
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        credential: true,
        profile: true,
        globalRoles: {
          include: {
            role: true,
          },
          where: {
            OR: [
              { validTo: null },
              { validTo: { gt: new Date() } },
            ],
          },
        },
      },
    });

    if (!user || !user.credential) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // パスワード未設定ユーザーのハンドリング（Google SSO専用）
    if (!user.credential.hashedPassword) {
      return NextResponse.json(
        { error: 'このアカウントはGoogleログインのみ対応しています' },
        { status: 400 }
      );
    }

    // アカウントがアクティブか確認
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is disabled' },
        { status: 401 }
      );
    }

    // アカウントロックの確認
    if (user.credential.lockedUntil && user.credential.lockedUntil > new Date()) {
      return NextResponse.json(
        { error: 'Account is locked. Please try again later.' },
        { status: 401 }
      );
    }

    // パスワード検証
    const isValid = await verifyPassword(user.credential.hashedPassword, password);

    if (!isValid) {
      // ログイン失敗カウントを増加
      await prisma.userCredential.update({
        where: { userId: user.id },
        data: {
          failedLoginAttempts: { increment: 1 },
          // 5回失敗したら15分ロック
          lockedUntil: user.credential.failedLoginAttempts >= 4
            ? new Date(Date.now() + 15 * 60 * 1000)
            : null,
        },
      });

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // メール確認チェック
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: 'メールアドレスの確認が完了していません。確認メールのリンクをクリックしてください。' },
        { status: 401 }
      );
    }

    // ログイン成功、失敗カウントをリセット & 最終ログイン日時を更新
    await Promise.all([
      prisma.userCredential.update({
        where: { userId: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    // ロール名配列を取得
    const roles = user.globalRoles.map(ur => ur.role.name);

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

    // セキュリティログ
    await prisma.securityLog.create({
      data: {
        userId: user.id,
        action: 'login_success',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
      },
    });

    // 期限切れトークンのクリーンアップ（バックグラウンドで実行、レスポンスをブロックしない）
    cleanupExpiredTokens().catch(console.error);

    // Cookieに設定
    const cookieStore = await cookies();

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

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.profile?.displayName,
        roles,
      },
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
