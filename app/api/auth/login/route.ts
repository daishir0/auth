import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import {
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  REFRESH_TOKEN_EXPIRES_IN_DAYS,
} from '@/lib/auth';

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

    // ログイン成功、失敗カウントをリセット
    await prisma.userCredential.update({
      where: { userId: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // ロール名配列を取得
    const roles = user.globalRoles.map(ur => ur.role.name);

    // トークン生成
    const accessToken = await generateAccessToken({
      userId: user.id,
      email: user.email,
      roles,
    });

    const refreshToken = generateRefreshToken();
    const refreshTokenExpiry = getRefreshTokenExpiry();

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

    // Cookieに設定
    const cookieStore = await cookies();

    cookieStore.set('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60, // 15分
      path: '/',
    });

    cookieStore.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60, // 30日
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
