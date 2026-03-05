import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // テストユーザーのパスワードをハッシュ化
  const hashedPassword = await argon2.hash('password123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // 既存のユーザーを削除（オプション）
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});

  // サンプルユーザー作成
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      hashedPassword,
      roles: 'user',
    },
  });

  console.log('Created user:', {
    id: user.id,
    email: user.email,
    roles: user.roles,
  });

  // 管理者ユーザーも作成
  const adminPassword = await argon2.hash('admin123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      hashedPassword: adminPassword,
      roles: 'user,admin',
    },
  });

  console.log('Created admin:', {
    id: admin.id,
    email: admin.email,
    roles: admin.roles,
  });

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
