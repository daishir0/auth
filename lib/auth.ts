import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'crypto';
import { getTokenSettings, TOKEN_DEFAULTS } from '@/lib/settings';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-production'
);

// デフォルト値（設定が取得できない場合のフォールバック）
export const REFRESH_TOKEN_EXPIRES_IN_DAYS = TOKEN_DEFAULTS.REFRESH_TOKEN_EXPIRES_DAYS;

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
}

/**
 * アクセストークン有効期限（分）を取得
 */
export async function getAccessTokenExpiryMinutes(): Promise<number> {
  const settings = await getTokenSettings();
  return settings.accessTokenExpiresMinutes;
}

/**
 * リフレッシュトークン有効期限（日）を取得
 */
export async function getRefreshTokenExpiryDays(): Promise<number> {
  const settings = await getTokenSettings();
  return settings.refreshTokenExpiresDays;
}

/**
 * アクセストークン（JWT）を生成
 */
export async function generateAccessToken(payload: TokenPayload): Promise<string> {
  const expiryMinutes = await getAccessTokenExpiryMinutes();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiryMinutes}m`)
    .sign(JWT_SECRET);
}

/**
 * アクセストークンを検証
 */
export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      roles: payload.roles as string[],
    };
  } catch {
    return null;
  }
}

/**
 * リフレッシュトークン（Opaque Token）を生成
 */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * リフレッシュトークンの有効期限を計算（設定から取得）
 */
export async function getRefreshTokenExpiry(): Promise<Date> {
  const days = await getRefreshTokenExpiryDays();
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}
