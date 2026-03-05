import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'crypto';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-production'
);

// アクセストークン有効期限: 15分
const ACCESS_TOKEN_EXPIRES_IN = '15m';
// リフレッシュトークン有効期限: 30日
export const REFRESH_TOKEN_EXPIRES_IN_DAYS = 30;

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
}

/**
 * アクセストークン（JWT）を生成
 */
export async function generateAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRES_IN)
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
 * リフレッシュトークンの有効期限を計算
 */
export function getRefreshTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);
  return expiry;
}
