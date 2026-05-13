/**
 * Redis ベースの分散レートリミット
 *
 * INCR + EXPIRE で固定ウィンドウ方式。
 * Redis 接続失敗時はフェイルオープン（リクエストを通す）にすることで、
 * Redis 障害によるサービス全停止を避ける。
 */
import IORedis, { type Redis } from 'ioredis';

let client: Redis | null = null;
let connectionAttempted = false;

function getClient(): Redis | null {
  if (connectionAttempted) return client;
  connectionAttempted = true;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('[rate-limit] REDIS_URL not set, rate limiting disabled');
    return null;
  }

  try {
    client = new IORedis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: true,
    });
    client.on('error', (err) => {
      console.error('[rate-limit] redis error:', err.message);
    });
  } catch (error) {
    console.error('[rate-limit] failed to create redis client:', error);
    client = null;
  }
  return client;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const redis = getClient();
  const now = Date.now();
  const resetAt = now + windowMs;

  // Redis 接続不可ならフェイルオープン
  if (!redis) {
    return { allowed: true, remaining: maxRequests, resetAt };
  }

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, windowMs);
    }
    const ttl = await redis.pttl(key);
    const actualReset = ttl > 0 ? now + ttl : resetAt;

    if (count > maxRequests) {
      return { allowed: false, remaining: 0, resetAt: actualReset };
    }
    return { allowed: true, remaining: Math.max(0, maxRequests - count), resetAt: actualReset };
  } catch (error) {
    console.error('[rate-limit] check failed:', error);
    return { allowed: true, remaining: maxRequests, resetAt };
  }
}
