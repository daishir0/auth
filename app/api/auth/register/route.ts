import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword } from '@/lib/password';

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName, firstName, lastName } = await request.json();

    // バリデーション
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // メールアドレスの重複チェック
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // パスワードをハッシュ化
    const hashedPassword = await hashPassword(password);

    // デフォルトロール（user）を取得
    const userRole = await prisma.globalRole.findUnique({
      where: { name: 'user' },
    });

    if (!userRole) {
      return NextResponse.json(
        { error: 'Default role not found. Please run seed first.' },
        { status: 500 }
      );
    }

    // ユーザー作成（トランザクション）
    const user = await prisma.user.create({
      data: {
        email,
        isActive: true,
        credential: {
          create: {
            hashedPassword,
          },
        },
        profile: {
          create: {
            displayName: displayName || email.split('@')[0],
            firstName,
            lastName,
          },
        },
        globalRoles: {
          create: {
            roleId: userRole.id,
          },
        },
      },
      include: {
        profile: true,
        globalRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          displayName: user.profile?.displayName,
          roles: user.globalRoles.map(ur => ur.role.name),
          createdAt: user.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
