/**
 * 認証ヘルパー
 *
 * 後方互換のため lib/oauth-auth.ts (RS256) への薄いラッパーとして残す。
 * HS256 実装は廃止済み。新規実装では lib/oauth-auth.ts を直接使うこと。
 */
import { randomBytes } from 'crypto';
import {
  generateAccessToken as oauthGenerateAccessToken,
  verifyAccessToken as oauthVerifyAccessToken,
  type TokenPayload,
} from '@/lib/oauth-auth';
import { getTokenSettings, TOKEN_DEFAULTS } from '@/lib/settings';

export const REFRESH_TOKEN_EXPIRES_IN_DAYS = TOKEN_DEFAULTS.REFRESH_TOKEN_EXPIRES_DAYS;
export type { TokenPayload };

export async function getAccessTokenExpiryMinutes(): Promise<number> {
  const settings = await getTokenSettings();
  return settings.accessTokenExpiresMinutes;
}

export async function getRefreshTokenExpiryDays(): Promise<number> {
  const settings = await getTokenSettings();
  return settings.refreshTokenExpiresDays;
}

/**
 * アクセストークン（RS256 署名）を生成
 */
export async function generateAccessToken(payload: TokenPayload): Promise<string> {
  return oauthGenerateAccessToken(payload);
}

/**
 * アクセストークン（RS256 署名）を検証
 */
export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  return oauthVerifyAccessToken(token);
}

/**
 * リフレッシュトークン（Opaque）を生成
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
