import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // リクエストボディまたはクッキーからリフレッシュトークン取得
    let refreshToken: string | undefined;

    try {
      const body = await request.json();
      refreshToken = body.refresh_token;
    } catch {
      // ボディがない場合はクッキーから取得
    }

    if (!refreshToken) {
      refreshToken = cookieStore.get('refresh_token')?.value;
    }

    // リフレッシュトークンをDBから削除
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    // Cookieを削除
    cookieStore.delete('access_token');
    cookieStore.delete('refresh_token');

    return NextResponse.json({
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
