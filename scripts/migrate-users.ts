/**
 * ユーザー移行スクリプト
 *
 * policy-managerの既存ユーザーをauthサービスに移行するスクリプト
 *
 * 使用方法:
 *   npx ts-node scripts/migrate-users.ts
 *
 * 環境変数:
 *   DATABASE_URL - auth サービスのPostgreSQL接続文字列
 *   POLICY_MANAGER_DATABASE_URL - policy-manager のPostgreSQL接続文字列
 */

import "dotenv/config";
import { PrismaClient as AuthPrismaClient } from "@prisma/client";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

// Auth サービスの Prisma クライアント
const authPrisma = new AuthPrismaClient();

// policy-manager の直接接続（スキーマが異なる可能性があるため生のSQLを使用）
const policyManagerPool = new Pool({
  connectionString:
    process.env.POLICY_MANAGER_DATABASE_URL ||
    "postgresql://policy_user:policy_password@localhost:5432/policy_manager",
});

interface OldUser {
  id: string;
  email: string;
  name: string | null;
  password: string | null;
  role: string;
  created_at: Date;
}

interface MigrationResult {
  email: string;
  oldId: string;
  newId: string;
  success: boolean;
  error?: string;
}

/**
 * ロールマッピング
 * policy-manager の ADMIN/STAFF → auth の super_admin/user
 */
function mapRole(oldRole: string): string {
  switch (oldRole.toUpperCase()) {
    case "ADMIN":
      return "super_admin";
    case "STAFF":
      return "user";
    default:
      return "user";
  }
}

async function migrateUsers(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  console.log("=".repeat(50));
  console.log("ユーザー移行スクリプト");
  console.log("=".repeat(50));

  try {
    // policy-manager から既存ユーザーを取得
    console.log("\n[1/4] policy-manager からユーザーを取得中...");
    const { rows: oldUsers } = await policyManagerPool.query<OldUser>(`
      SELECT id, email, name, password, role, created_at
      FROM users
      WHERE email IS NOT NULL
      ORDER BY created_at ASC
    `);

    console.log(`  → ${oldUsers.length} 件のユーザーを取得`);

    if (oldUsers.length === 0) {
      console.log("\n移行するユーザーがありません");
      return results;
    }

    // 既存の auth ユーザーを取得
    console.log("\n[2/4] auth サービスの既存ユーザーを確認中...");
    const existingAuthUsers = await authPrisma.user.findMany({
      select: { email: true, id: true },
    });
    const existingEmails = new Set(existingAuthUsers.map((u) => u.email));
    console.log(`  → ${existingAuthUsers.length} 件の既存ユーザー`);

    // UserIdMapping の既存レコードを取得
    const existingMappings = await authPrisma.userIdMapping.findMany({
      select: { legacyId: true },
    });
    const mappedLegacyIds = new Set(existingMappings.map((m) => m.legacyId));

    // ユーザーを移行
    console.log("\n[3/4] ユーザーを移行中...");

    for (const oldUser of oldUsers) {
      const result: MigrationResult = {
        email: oldUser.email,
        oldId: oldUser.id,
        newId: "",
        success: false,
      };

      try {
        // 既にマッピングされている場合はスキップ
        if (mappedLegacyIds.has(oldUser.id)) {
          const mapping = await authPrisma.userIdMapping.findFirst({
            where: { legacyId: oldUser.id },
          });
          result.newId = mapping?.userId || "";
          result.success = true;
          console.log(`  ✓ ${oldUser.email}: 既にマッピング済み`);
          results.push(result);
          continue;
        }

        // 同じメールアドレスが既に存在する場合
        if (existingEmails.has(oldUser.email)) {
          const existingUser = existingAuthUsers.find(
            (u) => u.email === oldUser.email
          );
          if (existingUser) {
            // マッピングを作成
            await authPrisma.userIdMapping.create({
              data: {
                userId: existingUser.id,
                legacyId: oldUser.id,
                sourceSystem: "policy-manager",
              },
            });
            result.newId = existingUser.id;
            result.success = true;
            console.log(`  ✓ ${oldUser.email}: 既存ユーザーにマッピング`);
            results.push(result);
            continue;
          }
        }

        // 新規ユーザーを作成
        const newUserId = randomUUID();
        const newRole = mapRole(oldUser.role);

        // パスワードがある場合はそのまま使用、ない場合はランダム生成
        const hashedPassword = oldUser.password || (await bcrypt.hash(randomUUID(), 12));

        // ユーザー作成
        const newUser = await authPrisma.user.create({
          data: {
            id: newUserId,
            email: oldUser.email,
          },
        });

        // 認証情報を作成
        await authPrisma.userCredential.create({
          data: {
            userId: newUserId,
            hashedPassword,
          },
        });

        // プロフィールを作成
        await authPrisma.userProfile.create({
          data: {
            userId: newUserId,
            displayName: oldUser.name || oldUser.email.split("@")[0],
          },
        });

        // グローバルロールを付与
        const role = await authPrisma.globalRole.findUnique({
          where: { name: newRole },
        });
        if (role) {
          await authPrisma.userGlobalRole.create({
            data: {
              userId: newUserId,
              roleId: role.id,
            },
          });
        }

        // IDマッピングを作成
        await authPrisma.userIdMapping.create({
          data: {
            userId: newUserId,
            legacyId: oldUser.id,
            sourceSystem: "policy-manager",
          },
        });

        result.newId = newUserId;
        result.success = true;
        console.log(`  ✓ ${oldUser.email}: 新規作成 (${newRole})`);
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ ${oldUser.email}: エラー - ${result.error}`);
      }

      results.push(result);
    }

    // サマリーを表示
    console.log("\n[4/4] 移行完了");
    console.log("=".repeat(50));
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    console.log(`  成功: ${successCount} 件`);
    console.log(`  失敗: ${failCount} 件`);
    console.log("=".repeat(50));

    return results;
  } catch (error) {
    console.error("\n移行エラー:", error);
    throw error;
  }
}

async function main() {
  try {
    const results = await migrateUsers();

    // 結果をJSONで出力
    const outputPath = `./migration-results-${new Date().toISOString().split("T")[0]}.json`;
    const fs = await import("fs");
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n結果を ${outputPath} に保存しました`);
  } catch (error) {
    console.error("移行に失敗しました:", error);
    process.exit(1);
  } finally {
    await authPrisma.$disconnect();
    await policyManagerPool.end();
  }
}

main();
