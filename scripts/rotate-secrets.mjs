import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function gen(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

const secretDev = 'pm-dev-' + gen(32);
const secretProd = 'pm-prod-' + gen(32);

async function upsertClient(opts) {
  const hashed = await argon2.hash(opts.secret, { type: argon2.argon2id });
  const existing = await prisma.oAuthClient.findUnique({ where: { clientId: opts.clientId } });
  if (existing) {
    await prisma.oAuthClient.update({
      where: { clientId: opts.clientId },
      data: {
        clientSecret: hashed,
        redirectUris: opts.redirectUris,
        grantTypes: ['authorization_code', 'refresh_token'],
        scopes: ['openid', 'profile', 'email', 'custom'],
        name: opts.name,
        description: opts.description,
        appUrl: opts.appUrl,
      },
    });
    console.log('Updated:', opts.clientId);
  } else {
    await prisma.oAuthClient.create({
      data: {
        clientId: opts.clientId,
        clientSecret: hashed,
        name: opts.name,
        description: opts.description,
        appUrl: opts.appUrl,
        redirectUris: opts.redirectUris,
        grantTypes: ['authorization_code', 'refresh_token'],
        scopes: ['openid', 'profile', 'email', 'custom'],
      },
    });
    console.log('Created:', opts.clientId);
  }
}

await upsertClient({
  clientId: 'policy-manager-prod',
  secret: secretProd,
  name: 'Policy Manager (Prod)',
  description: 'ポリシー文書管理システム（本番）',
  appUrl: 'https://policy-manager.senku.work',
  redirectUris: ['https://policy-manager.senku.work/api/auth/callback/auth-provider'],
});

await upsertClient({
  clientId: 'policy-manager-dev',
  secret: secretDev,
  name: 'Policy Manager (Dev)',
  description: 'ポリシー文書管理システム（開発）',
  appUrl: 'https://policy-manager-dev.senku.work',
  redirectUris: ['https://policy-manager-dev.senku.work/api/auth/callback/auth-provider'],
});

// 古いレコード削除（旧 policy-manager と 旧 ハッシュID）
await prisma.oAuthClient.deleteMany({
  where: {
    clientId: { in: ['policy-manager', '6ba7fc0d8721238e74828626778309a8'] },
  },
});
console.log('Deleted old records');

console.log('--- SECRETS (record carefully) ---');
console.log('AUTH_PROVIDER_SECRET_PROD=' + secretProd);
console.log('AUTH_PROVIDER_SECRET_DEV=' + secretDev);

await prisma.$disconnect();
