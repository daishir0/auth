import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get('access_token')?.value;
  }

  if (!token) {
    return null;
  }

  return await verifyAccessToken(token);
}

/**
 * POST /api/users/[id]/password
 * パスワードを設定/変更する
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const currentUser = await getAuthenticatedUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // 自分自身のみ変更可能（管理者は別途admin APIで対応）
    if (currentUser.userId !== userId) {
      return NextResponse.json(
        { error: '自分以外のパスワードは変更できません' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // 新しいパスワードのバリデーション
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'パスワードは8文字以上で入力してください' },
        { status: 400 }
      );
    }

    // ユーザーの認証情報を取得
    const credential = await prisma.userCredential.findUnique({
      where: { userId },
    });

    if (!credential) {
      return NextResponse.json(
        { error: 'ユーザー情報が見つかりません' },
        { status: 404 }
      );
    }

    // 既存のパスワードがある場合、現在のパスワードの確認が必要
    if (credential.hashedPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: '現在のパスワードを入力してください' },
          { status: 400 }
        );
      }

      const isValid = await verifyPassword(credential.hashedPassword, currentPassword);
      if (!isValid) {
        return NextResponse.json(
          { error: '現在のパスワードが正しくありません' },
          { status: 400 }
        );
      }
    }

    // 新しいパスワードをハッシュ化して保存
    const hashedPassword = await hashPassword(newPassword);

    await prisma.userCredential.update({
      where: { userId },
      data: {
        hashedPassword,
        passwordChangedAt: new Date(),
      },
    });

    // セキュリティログ
    await prisma.securityLog.create({
      data: {
        userId,
        action: credential.hashedPassword ? 'password_changed' : 'password_set',
        ipAddress:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
      },
    });

    return NextResponse.json({
      message: credential.hashedPassword
        ? 'パスワードを変更しました'
        : 'パスワードを設定しました',
    });
  } catch (error) {
    console.error('Password update error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
