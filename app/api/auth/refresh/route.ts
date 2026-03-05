import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import {
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  REFRESH_TOKEN_EXPIRES_IN_DAYS,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // リクエストボディまたはクッキーからリフレッシュトークン取得
    let refreshTokenValue: string | undefined;

    try {
      const body = await request.json();
      refreshTokenValue = body.refresh_token;
    } catch {
      // ボディがない場合はクッキーから取得
    }

    if (!refreshTokenValue) {
      const cookieStore = await cookies();
      refreshTokenValue = cookieStore.get('refresh_token')?.value;
    }

    if (!refreshTokenValue) {
      return NextResponse.json(
        { error: 'No refresh token provided' },
        { status: 401 }
      );
    }

    // DBからリフレッシュトークン検索
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenValue },
      include: { user: true },
    });

    if (!storedToken) {
      return NextResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      );
    }

    // 有効期限チェック
    if (storedToken.expiresAt < new Date()) {
      // 期限切れトークンを削除
      await prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });

      return NextResponse.json(
        { error: 'Refresh token expired' },
        { status: 401 }
      );
    }

    // 新しいトークンを生成
    const newAccessToken = await generateAccessToken({
      userId: storedToken.user.id,
      email: storedToken.user.email,
      roles: storedToken.user.roles.split(','),
    });

    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenExpiry = getRefreshTokenExpiry();

    // 古いリフレッシュトークンを削除し、新しいものを保存
    await prisma.$transaction([
      prisma.refreshToken.delete({
        where: { id: storedToken.id },
      }),
      prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: storedToken.user.id,
          expiresAt: newRefreshTokenExpiry,
        },
      }),
    ]);

    // Cookieを更新
    const cookieStore = await cookies();

    cookieStore.set('access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    });

    cookieStore.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60,
      path: '/',
    });

    return NextResponse.json({
      message: 'Token refreshed successfully',
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
