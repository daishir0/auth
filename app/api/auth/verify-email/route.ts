import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * GET /api/auth/verify-email?token=xxx
 * メール確認トークンを検証し、アカウントを有効化
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'トークンが指定されていません' },
        { status: 400 }
      );
    }

    // トークンを検索
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: 'トークンが無効です' },
        { status: 400 }
      );
    }

    // 有効期限チェック
    if (verificationToken.expiresAt < new Date()) {
      // 期限切れトークンを削除
      await prisma.emailVerificationToken.delete({
        where: { id: verificationToken.id },
      });
      return NextResponse.json(
        { error: 'トークンの有効期限が切れています' },
        { status: 400 }
      );
    }

    // type による分岐処理
    if (verificationToken.type === 'register') {
      // 新規ユーザー登録
      const existingUser = await prisma.user.findUnique({
        where: { email: verificationToken.email },
      });

      if (existingUser) {
        // トークン削除
        await prisma.emailVerificationToken.delete({
          where: { id: verificationToken.id },
        });
        return NextResponse.json(
          { error: 'このメールアドレスは既に登録されています' },
          { status: 409 }
        );
      }

      // デフォルトロール（user）を取得
      const userRole = await prisma.globalRole.findUnique({
        where: { name: 'user' },
      });

      if (!userRole) {
        return NextResponse.json(
          { error: 'システムエラー: デフォルトロールが見つかりません' },
          { status: 500 }
        );
      }

      // ユーザー作成（トランザクション）
      await prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            email: verificationToken.email,
            emailVerified: true,
            isActive: true,
            credential: {
              create: {
                hashedPassword: verificationToken.hashedPassword,
              },
            },
            profile: {
              create: {
                displayName: verificationToken.displayName || verificationToken.email.split('@')[0],
                firstName: verificationToken.firstName,
                lastName: verificationToken.lastName,
              },
            },
            globalRoles: {
              create: {
                roleId: userRole.id,
              },
            },
          },
        });

        // トークン削除
        await tx.emailVerificationToken.delete({
          where: { id: verificationToken.id },
        });
      });

      return NextResponse.json({
        success: true,
        type: 'register',
        message: 'メールアドレスの確認が完了しました。ログインしてください。',
      });

    } else if (verificationToken.type === 'add_password') {
      // 既存ユーザーにパスワード追加
      const user = await prisma.user.findUnique({
        where: { email: verificationToken.email },
        include: { credential: true },
      });

      if (!user) {
        await prisma.emailVerificationToken.delete({
          where: { id: verificationToken.id },
        });
        return NextResponse.json(
          { error: 'ユーザーが見つかりません' },
          { status: 404 }
        );
      }

      // パスワード設定（トランザクション）
      await prisma.$transaction(async (tx) => {
        if (user.credential) {
          // 既存の認証情報を更新
          await tx.userCredential.update({
            where: { userId: user.id },
            data: {
              hashedPassword: verificationToken.hashedPassword,
              passwordChangedAt: new Date(),
            },
          });
        } else {
          // 新規認証情報を作成
          await tx.userCredential.create({
            data: {
              userId: user.id,
              hashedPassword: verificationToken.hashedPassword,
            },
          });
        }

        // emailVerified を true に更新
        await tx.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        });

        // トークン削除
        await tx.emailVerificationToken.delete({
          where: { id: verificationToken.id },
        });
      });

      return NextResponse.json({
        success: true,
        type: 'add_password',
        message: 'パスワードの設定が完了しました。ログインしてください。',
      });

    } else {
      return NextResponse.json(
        { error: '不正なトークンタイプです' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: '確認処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
