import prisma from '@/lib/db';

/**
 * 期限切れトークンのクリーンアップ
 * ログイン成功時に非同期で実行される（レスポンスをブロックしない）
 */
export async function cleanupExpiredTokens(): Promise<void> {
  const now = new Date();

  try {
    // 並列で削除を実行
    const [refreshTokensDeleted, authCodesDeleted, rateLimitsDeleted] = await Promise.all([
      // 期限切れ RefreshToken を削除
      prisma.refreshToken.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
      }),

      // 期限切れ AuthorizationCode を削除
      prisma.authorizationCode.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
      }),

      // 期限切れ RateLimitEntry を削除
      prisma.rateLimitEntry.deleteMany({
        where: {
          resetAt: { lt: now },
        },
      }),
    ]);

    // ログ出力（削除があった場合のみ）
    const totalDeleted =
      refreshTokensDeleted.count +
      authCodesDeleted.count +
      rateLimitsDeleted.count;

    if (totalDeleted > 0) {
      console.log(
        `[Token Cleanup] Deleted: ${refreshTokensDeleted.count} refresh tokens, ` +
          `${authCodesDeleted.count} auth codes, ${rateLimitsDeleted.count} rate limits`
      );
    }
  } catch (error) {
    console.error('[Token Cleanup] Error:', error);
  }
}
