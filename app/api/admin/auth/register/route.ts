import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { isSesEnabled } from '@/lib/settings';
import { sendVerificationEmail } from '@/lib/ses';

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName, firstName, lastName } = await request.json();

    // 1. バリデーション
    if (!email || !password) {
      return NextResponse.json(
        { error: 'メールアドレスとパスワードは必須です' },
        { status: 400 }
      );
    }

    // 2. パスワード長チェック
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'パスワードは8文字以上で入力してください' },
        { status: 400 }
      );
    }

    // 3. 既存ユーザーチェック
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { credential: true },
    });

    // 4. SES設定チェック
    const sesEnabled = await isSesEnabled();
    if (!sesEnabled) {
      return NextResponse.json(
        { error: 'メール送信機能が設定されていません。管理者にお問い合わせください。' },
        { status: 503 }
      );
    }

    // 5. パスワードハッシュ化
    const hashedPassword = await hashPassword(password);

    // 6. 既存トークンを削除（同じメールアドレスの古いトークン）
    await prisma.emailVerificationToken.deleteMany({
      where: { email },
    });

    // 7. トークン生成（32バイト = 64文字の16進数）
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間後

    // 8. 既存ユーザーの有無と状態で処理を分岐
    let tokenType: 'register' | 'add_password';

    if (existingUser) {
      // 既存ユーザーがいる場合
      if (existingUser.credential?.hashedPassword) {
        // パスワードが既に設定されている → エラー
        return NextResponse.json(
          { error: 'このメールアドレスは既に登録されています' },
          { status: 409 }
        );
      }

      // パスワードがない（Google SSO専用ユーザー）→ パスワード追加フロー
      tokenType = 'add_password';

      await prisma.emailVerificationToken.create({
        data: {
          email,
          token,
          type: tokenType,
          hashedPassword,
          expiresAt,
        },
      });
    } else {
      // 新規ユーザー → 新規登録フロー
      tokenType = 'register';

      await prisma.emailVerificationToken.create({
        data: {
          email,
          token,
          type: tokenType,
          hashedPassword,
          displayName: displayName || email.split('@')[0],
          firstName,
          lastName,
          expiresAt,
        },
      });
    }

    // 9. 確認メール送信
    try {
      await sendVerificationEmail({
        email,
        token,
        type: tokenType,
      });
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // トークンを削除
      await prisma.emailVerificationToken.delete({
        where: { token },
      });
      return NextResponse.json(
        { error: 'メール送信に失敗しました。しばらく経ってからお試しください。' },
        { status: 500 }
      );
    }

    // 10. 成功レスポンス
    return NextResponse.json(
      {
        success: true,
        message: '確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。',
        type: tokenType,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: '登録処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
