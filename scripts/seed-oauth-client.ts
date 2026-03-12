/**
 * OAuthクライアントのシードスクリプト
 * テスト用のOAuthクライアントを作成する
 */

import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();

// クライアントシークレットをハッシュ化
function hashClientSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

async function main() {
  console.log('OAuthクライアントのシード開始...');

  // テスト用クライアントの設定
  const testClientId = 'test-client';
  const testClientSecret = 'test-secret-12345';

  // 既存のクライアントを確認
  const existingClient = await prisma.oAuthClient.findUnique({
    where: { clientId: testClientId },
  });

  if (existingClient) {
    console.log(`クライアント "${testClientId}" は既に存在します`);
    console.log('クライアント情報:');
    console.log(`  ID: ${existingClient.id}`);
    console.log(`  Client ID: ${existingClient.clientId}`);
    console.log(`  Name: ${existingClient.name}`);
    console.log(`  Redirect URIs: ${existingClient.redirectUris}`);
    console.log(`  Scopes: ${existingClient.scopes}`);
    console.log(`  Grant Types: ${existingClient.grantTypes}`);
  } else {
    // 新しいクライアントを作成
    const client = await prisma.oAuthClient.create({
      data: {
        clientId: testClientId,
        clientSecret: hashClientSecret(testClientSecret),
        name: 'テストアプリケーション',
        description: 'OAuth 2.0テスト用クライアント',
        redirectUris: 'http://localhost:8080/callback,http://localhost:3000/callback,https://oauth.pstmn.io/v1/callback',
        scopes: 'openid,profile,email,offline_access',
        grantTypes: 'authorization_code,refresh_token',
        isActive: true,
      },
    });

    console.log('新しいOAuthクライアントを作成しました！');
    console.log('');
    console.log('=== クライアント情報 ===');
    console.log(`Client ID: ${testClientId}`);
    console.log(`Client Secret: ${testClientSecret}`);
    console.log(`Name: ${client.name}`);
    console.log(`Redirect URIs: ${client.redirectUris}`);
    console.log(`Scopes: ${client.scopes}`);
    console.log(`Grant Types: ${client.grantTypes}`);
    console.log('');
    console.log('※ この情報はOAuthテストに使用します。');
  }

  // CLIテスト用クライアント（PKCEサポート）
  const cliClientId = 'cli-test-client';
  const cliClientSecret = 'cli-secret-67890';

  const existingCliClient = await prisma.oAuthClient.findUnique({
    where: { clientId: cliClientId },
  });

  if (!existingCliClient) {
    await prisma.oAuthClient.create({
      data: {
        clientId: cliClientId,
        clientSecret: hashClientSecret(cliClientSecret),
        name: 'CLIテストクライアント',
        description: 'OAuth CLI検証用クライアント（PKCE対応）',
        redirectUris: 'http://localhost:9999/callback',
        scopes: 'openid,profile,email,offline_access',
        grantTypes: 'authorization_code,refresh_token',
        isActive: true,
      },
    });

    console.log('');
    console.log('=== CLIテストクライアント情報 ===');
    console.log(`Client ID: ${cliClientId}`);
    console.log(`Client Secret: ${cliClientSecret}`);
  }

  // policy-manager用クライアント（OAuth 2.0 / OIDC対応）
  const policyManagerClientId = 'policy-manager';
  const policyManagerClientSecret = 'pm-secret-' + randomBytes(16).toString('hex');

  const existingPolicyManagerClient = await prisma.oAuthClient.findUnique({
    where: { clientId: policyManagerClientId },
  });

  if (existingPolicyManagerClient) {
    console.log('');
    console.log('=== Policy Manager クライアント情報 ===');
    console.log(`Client ID: ${existingPolicyManagerClient.clientId}`);
    console.log(`Name: ${existingPolicyManagerClient.name}`);
    console.log(`Redirect URIs: ${existingPolicyManagerClient.redirectUris}`);
    console.log(`Scopes: ${existingPolicyManagerClient.scopes}`);
    console.log('※ シークレットは既存のものを使用してください');
  } else {
    await prisma.oAuthClient.create({
      data: {
        clientId: policyManagerClientId,
        clientSecret: hashClientSecret(policyManagerClientSecret),
        name: 'Policy Manager',
        description: 'ポリシー管理システム（OAuth 2.0 / OIDC認証）',
        redirectUris: 'https://policy-manager.senku.work/api/auth/callback/senku-auth,http://localhost:3018/api/auth/callback/senku-auth',
        scopes: 'openid,profile,email',
        grantTypes: 'authorization_code,refresh_token',
        isActive: true,
      },
    });

    console.log('');
    console.log('=== Policy Manager クライアント情報（新規作成） ===');
    console.log(`Client ID: ${policyManagerClientId}`);
    console.log(`Client Secret: ${policyManagerClientSecret}`);
    console.log(`Redirect URIs: https://policy-manager.senku.work/api/auth/callback/senku-auth,http://localhost:3018/api/auth/callback/senku-auth`);
    console.log(`Scopes: openid,profile,email`);
    console.log('');
    console.log('*** このシークレットを policy-manager の .env に設定してください ***');
  }

  console.log('');
  console.log('シード完了！');
}

main()
  .catch((e) => {
    console.error('エラー:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
