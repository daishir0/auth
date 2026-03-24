import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const AVATAR_DIR = path.join(process.cwd(), 'public', 'avatars');

// UUID形式のバリデーション（パストラバーサル対策）
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // .jpg 拡張子を除去（URLが userId.jpg の場合）
    const cleanUserId = userId.replace(/\.jpg$/, '');

    // セキュリティ: UUID形式のバリデーション（パストラバーサル対策）
    if (!UUID_REGEX.test(cleanUserId)) {
      return new NextResponse('Bad Request', { status: 400 });
    }

    // ファイルパスを構築
    const filePath = path.join(AVATAR_DIR, `${cleanUserId}.jpg`);

    // ファイルが存在するか確認
    try {
      await fs.access(filePath);
    } catch {
      // ファイルが存在しない場合、デフォルト画像を返す
      const defaultPath = path.join(AVATAR_DIR, 'default.png');
      try {
        const defaultData = await fs.readFile(defaultPath);
        return new NextResponse(defaultData, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=60',
          },
        });
      } catch {
        return new NextResponse('Not Found', { status: 404 });
      }
    }

    // ファイルを読み込み
    const fileData = await fs.readFile(filePath);

    // レスポンスを返す
    return new NextResponse(fileData, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Avatar fetch error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
