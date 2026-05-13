/**
 * CORS ヘルパー（ホワイトリスト方式）
 *
 * CORS_ALLOWED_ORIGINS 環境変数のカンマ区切りリストに含まれる
 * Origin のみ Access-Control-Allow-Origin を echoback する。
 * "*" は許可しない（明示的なオリジン指定を強制）。
 */

const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0 && o !== '*');

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * リクエストに対する CORS レスポンスヘッダーを構築する。
 * 許可されないオリジンの場合は Access-Control-Allow-Origin を付けない。
 */
export function corsHeaders(
  origin?: string | null,
  options: { methods?: string; headers?: string; credentials?: boolean } = {},
): Record<string, string> {
  const result: Record<string, string> = {
    'Access-Control-Allow-Methods': options.methods ?? 'POST, OPTIONS',
    'Access-Control-Allow-Headers': options.headers ?? 'Content-Type, Authorization',
    Vary: 'Origin',
  };

  if (origin && isAllowedOrigin(origin)) {
    result['Access-Control-Allow-Origin'] = origin;
    if (options.credentials) {
      result['Access-Control-Allow-Credentials'] = 'true';
    }
  }

  return result;
}

export function getAllowedOrigins(): string[] {
  return [...ALLOWED_ORIGINS];
}
