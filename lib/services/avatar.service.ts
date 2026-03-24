import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/lib/db';

const AVATAR_SIZE = 128;
const AVATAR_DIR = path.join(process.cwd(), 'public', 'avatars');
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export interface AvatarUploadResult {
  success: boolean;
  avatarUrl?: string;
  error?: string;
}

export async function uploadAvatar(
  userId: string,
  file: File
): Promise<AvatarUploadResult> {
  // バリデーション
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      success: false,
      error: '対応していない画像形式です。JPEG, PNG, GIF, WebPを使用してください。',
    };
  }

  if (file.size > 5 * 1024 * 1024) {
    return {
      success: false,
      error: 'ファイルサイズは5MB以下にしてください。',
    };
  }

  try {
    // ディレクトリが存在することを確認
    await fs.mkdir(AVATAR_DIR, { recursive: true });

    // 既存のアバターを削除
    await deleteExistingAvatar(userId);

    // ファイルをバッファに読み込み
    const buffer = Buffer.from(await file.arrayBuffer());

    // 画像をリサイズ・変換
    const processedImage = await sharp(buffer)
      .resize(AVATAR_SIZE, AVATAR_SIZE, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    // ファイル名を生成（userId.jpg）
    const fileName = `${userId}.jpg`;
    const filePath = path.join(AVATAR_DIR, fileName);

    // ファイルを保存
    await fs.writeFile(filePath, processedImage);

    // URLを生成
    const avatarUrl = `/avatars/${fileName}`;

    // DBを更新
    await prisma.userProfile.upsert({
      where: { userId },
      update: { avatarUrl },
      create: {
        userId,
        avatarUrl,
      },
    });

    return {
      success: true,
      avatarUrl,
    };
  } catch (error) {
    console.error('Avatar upload error:', error);
    return {
      success: false,
      error: 'アバターのアップロードに失敗しました。',
    };
  }
}

export async function deleteAvatar(userId: string): Promise<AvatarUploadResult> {
  try {
    await deleteExistingAvatar(userId);

    // DBを更新
    await prisma.userProfile.update({
      where: { userId },
      data: { avatarUrl: null },
    });

    return { success: true };
  } catch (error) {
    console.error('Avatar delete error:', error);
    return {
      success: false,
      error: 'アバターの削除に失敗しました。',
    };
  }
}

async function deleteExistingAvatar(userId: string): Promise<void> {
  const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

  for (const ext of extensions) {
    const filePath = path.join(AVATAR_DIR, `${userId}.${ext}`);
    try {
      await fs.unlink(filePath);
    } catch {
      // ファイルが存在しない場合は無視
    }
  }
}

export function getAvatarUrl(userId: string, avatarUrl: string | null): string {
  if (avatarUrl) {
    return avatarUrl;
  }
  return `/avatars/default.png`;
}
