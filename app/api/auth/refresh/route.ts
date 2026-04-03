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

    // DBからリフレッシュトークン検索（ユーザーとロールを含む）
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenValue },
      include: {
        user: {
          include: {
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
        },
      },
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

    // ユーザーがアクティブか確認
    if (!storedToken.user.isActive) {
      return NextResponse.json(
        { error: 'Account is disabled' },
        { status: 401 }
      );
    }

    // ロール名配列を取得
    const roles = storedToken.user.globalRoles.map(ur => ur.role.name);

    // 新しいトークンを生成
    const newAccessToken = await generateAccessToken({
      userId: storedToken.user.id,
      email: storedToken.user.email,
      roles,
    });

    const newRefreshToken = generateRefreshToken();
    const [newRefreshTokenExpiry, accessTokenExpiryMinutes, refreshTokenExpiryDays] = await Promise.all([
      getRefreshTokenExpiry(),
      getAccessTokenExpiryMinutes(),
      getRefreshTokenExpiryDays(),
    ]);

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

    // セキュリティログ
    await prisma.securityLog.create({
      data: {
        userId: storedToken.user.id,
        action: 'token_refresh',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
      },
    });

    // Cookieを更新
    const cookieStore = await cookies();

    cookieStore.set('access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: accessTokenExpiryMinutes * 60,
      path: '/',
    });

    cookieStore.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: refreshTokenExpiryDays * 24 * 60 * 60,
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
