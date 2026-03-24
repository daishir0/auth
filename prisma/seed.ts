import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // ========================================
  // グローバル権限の作成
  // ========================================
  const permissions = [
    // ユーザー管理
    { name: 'users:read', displayName: 'ユーザー閲覧', category: 'users', description: 'ユーザー情報の閲覧' },
    { name: 'users:write', displayName: 'ユーザー編集', category: 'users', description: 'ユーザー情報の作成・更新' },
    { name: 'users:delete', displayName: 'ユーザー削除', category: 'users', description: 'ユーザーの削除' },
    // 組織管理
    { name: 'organizations:read', displayName: '組織閲覧', category: 'organizations', description: '組織情報の閲覧' },
    { name: 'organizations:write', displayName: '組織編集', category: 'organizations', description: '組織の作成・更新' },
    { name: 'organizations:delete', displayName: '組織削除', category: 'organizations', description: '組織の削除' },
    // 役職管理
    { name: 'positions:read', displayName: '役職閲覧', category: 'positions', description: '役職情報の閲覧' },
    { name: 'positions:write', displayName: '役職編集', category: 'positions', description: '役職の作成・更新' },
    { name: 'positions:delete', displayName: '役職削除', category: 'positions', description: '役職の削除' },
    // ロール管理
    { name: 'roles:read', displayName: 'ロール閲覧', category: 'roles', description: 'ロール情報の閲覧' },
    { name: 'roles:write', displayName: 'ロール編集', category: 'roles', description: 'ロールの作成・更新' },
    { name: 'roles:delete', displayName: 'ロール削除', category: 'roles', description: 'ロールの削除' },
    // クライアント管理
    { name: 'clients:read', displayName: 'クライアント閲覧', category: 'clients', description: 'OAuthクライアントの閲覧' },
    { name: 'clients:write', displayName: 'クライアント編集', category: 'clients', description: 'OAuthクライアントの作成・更新' },
    { name: 'clients:delete', displayName: 'クライアント削除', category: 'clients', description: 'OAuthクライアントの削除' },
    // システム管理
    { name: 'system:admin', displayName: 'システム管理', category: 'system', description: 'システム全体の管理権限' },
  ];

  const createdPermissions: Record<string, string> = {};
  for (const perm of permissions) {
    const created = await prisma.globalPermission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
    createdPermissions[perm.name] = created.id;
    console.log(`  Permission created: ${perm.name}`);
  }

  // ========================================
  // グローバルロールの作成
  // ========================================
  const roles = [
    {
      name: 'super_admin',
      displayName: 'スーパー管理者',
      description: 'システム全体の管理権限を持つロール',
      isSystem: true,
      permissions: Object.keys(createdPermissions), // 全権限
    },
    {
      name: 'admin',
      displayName: '管理者',
      description: '一般的な管理権限を持つロール',
      isSystem: true,
      permissions: [
        'users:read', 'users:write',
        'organizations:read', 'organizations:write',
        'positions:read', 'positions:write',
        'roles:read',
        'clients:read',
      ],
    },
    {
      name: 'user',
      displayName: '一般ユーザー',
      description: '基本的な権限を持つロール',
      isSystem: true,
      permissions: [
        'users:read',
        'organizations:read',
        'positions:read',
      ],
    },
  ];

  for (const roleData of roles) {
    const { permissions: permNames, ...roleInfo } = roleData;

    const role = await prisma.globalRole.upsert({
      where: { name: roleInfo.name },
      update: {},
      create: roleInfo,
    });

    // ロールと権限の関連付け
    for (const permName of permNames) {
      const permId = createdPermissions[permName];
      if (permId) {
        await prisma.globalRolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permId,
          },
        });
      }
    }
    console.log(`  Role created: ${roleInfo.name}`);
  }

  // ========================================
  // デフォルト組織の作成
  // ========================================
  const defaultOrg = await prisma.organization.upsert({
    where: { code: 'default' },
    update: {},
    create: {
      name: 'デフォルト組織',
      code: 'default',
      description: 'システムデフォルトの組織',
      level: 0,
    },
  });
  console.log(`  Organization created: ${defaultOrg.code}`);

  // ========================================
  // デフォルト役職の作成
  // ========================================
  const positions = [
    { name: '代表取締役', code: 'ceo', level: 100 },
    { name: '取締役', code: 'director', level: 90 },
    { name: '部長', code: 'manager', level: 70 },
    { name: '課長', code: 'section_chief', level: 60 },
    { name: '主任', code: 'chief', level: 50 },
    { name: '一般社員', code: 'staff', level: 10 },
  ];

  for (const pos of positions) {
    await prisma.position.upsert({
      where: { code: pos.code },
      update: {},
      create: pos,
    });
    console.log(`  Position created: ${pos.code}`);
  }

  // ========================================
  // スーパー管理者ユーザーの作成
  // ========================================
  const superAdminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('SEED_ADMIN_PASSWORD environment variable is required');
  }
  const hashedPassword = await argon2.hash(adminPassword);

  const superAdminRole = await prisma.globalRole.findUnique({
    where: { name: 'super_admin' },
  });

  if (!superAdminRole) {
    throw new Error('super_admin role not found');
  }

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      isActive: true,
      credential: {
        create: {
          hashedPassword,
        },
      },
      profile: {
        create: {
          displayName: 'システム管理者',
          firstName: '管理者',
          lastName: 'システム',
        },
      },
      globalRoles: {
        create: {
          roleId: superAdminRole.id,
        },
      },
    },
  });
  console.log(`  Super admin user created: ${superAdmin.email}`);

  // ========================================
  // テスト用一般ユーザーの作成
  // ========================================
  const testUserEmail = process.env.SEED_USER_EMAIL || 'user@example.com';
  const userPassword = process.env.SEED_USER_PASSWORD;
  if (!userPassword) {
    throw new Error('SEED_USER_PASSWORD environment variable is required');
  }
  const testHashedPassword = await argon2.hash(userPassword);

  const userRole = await prisma.globalRole.findUnique({
    where: { name: 'user' },
  });

  if (!userRole) {
    throw new Error('user role not found');
  }

  const staffPosition = await prisma.position.findUnique({
    where: { code: 'staff' },
  });

  const testUser = await prisma.user.upsert({
    where: { email: testUserEmail },
    update: {},
    create: {
      email: testUserEmail,
      isActive: true,
      credential: {
        create: {
          hashedPassword: testHashedPassword,
        },
      },
      profile: {
        create: {
          displayName: 'テストユーザー',
          firstName: '太郎',
          lastName: 'テスト',
        },
      },
      globalRoles: {
        create: {
          roleId: userRole.id,
        },
      },
      organizationMemberships: {
        create: {
          organizationId: defaultOrg.id,
          positionId: staffPosition?.id,
          isPrimary: true,
        },
      },
    },
  });
  console.log(`  Test user created: ${testUser.email}`);

  // ========================================
  // policy-manager OAuthクライアントの作成
  // ========================================
  const clientSecret = 'pm-secret-c0643156fa77a94d2030d289bb163b7d';
  const hashedSecret = await argon2.hash(clientSecret);

  // リダイレクトURIを環境変数から取得（カンマ区切り）
  const redirectUris = (process.env.SEED_OAUTH_REDIRECT_URIS || '')
    .split(',')
    .map(uri => uri.trim())
    .filter(Boolean);

  // デフォルト値（環境変数が設定されていない場合）
  const defaultRedirectUris = [
    'http://localhost:3018/api/auth/callback/auth-provider',
  ];

  await prisma.oAuthClient.upsert({
    where: { clientId: 'policy-manager' },
    update: {},
    create: {
      clientId: 'policy-manager',
      clientSecret: hashedSecret,
      name: 'Policy Manager',
      description: 'ポリシー管理システム',
      redirectUris: redirectUris.length > 0 ? redirectUris : defaultRedirectUris,
      scopes: ['openid', 'profile', 'email', 'custom'],
      grantTypes: ['authorization_code', 'refresh_token'],
    },
  });
  console.log('  OAuth client created: policy-manager');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
