/**
 * OAuth 2.0 / OpenID Connect 認証ライブラリ
 * RS256署名を使用した中央認証基盤
 */

import { SignJWT, jwtVerify, importPKCS8, importSPKI, exportJWK } from 'jose';
import { randomBytes, createHash, generateKeyPairSync } from 'crypto';
import * as argon2 from 'argon2';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// 鍵ファイルのパス
const KEYS_DIR = join(process.cwd(), 'keys');
const PRIVATE_KEY_PATH = join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = join(KEYS_DIR, 'public.pem');

// トークン有効期限
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const ID_TOKEN_EXPIRES_IN = '1h';
const AUTH_CODE_EXPIRES_IN_SECONDS = 600; // 10分
export const REFRESH_TOKEN_EXPIRES_IN_DAYS = 30;

// 発行者URL
export function getIssuer(): string {
  return process.env.OAUTH_ISSUER || 'http://localhost:3019';
}

// 鍵ID
let _keyId: string | null = null;
export function getKeyId(): string {
  if (!_keyId) {
    _keyId = process.env.OAUTH_KEY_ID || 'auth-key-001';
  }
  return _keyId;
}

// キャッシュ
let _privateKey: CryptoKey | null = null;
let _publicKey: CryptoKey | null = null;

/**
 * RS256鍵ペアを生成して保存（Node.js crypto使用）
 */
export function generateAndSaveKeyPairSync(): void {
  if (!existsSync(KEYS_DIR)) {
    mkdirSync(KEYS_DIR, { recursive: true });
  }

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  writeFileSync(PRIVATE_KEY_PATH, privateKey);
  writeFileSync(PUBLIC_KEY_PATH, publicKey);

  // キャッシュをクリア
  _privateKey = null;
  _publicKey = null;
}

/**
 * 秘密鍵を読み込み
 */
export async function getPrivateKey(): Promise<CryptoKey> {
  if (_privateKey) return _privateKey;

  if (!existsSync(PRIVATE_KEY_PATH)) {
    generateAndSaveKeyPairSync();
  }

  const pem = readFileSync(PRIVATE_KEY_PATH, 'utf-8');
  _privateKey = await importPKCS8(pem, 'RS256');
  return _privateKey;
}

/**
 * 公開鍵を読み込み
 */
export async function getPublicKey(): Promise<CryptoKey> {
  if (_publicKey) return _publicKey;

  if (!existsSync(PUBLIC_KEY_PATH)) {
    generateAndSaveKeyPairSync();
  }

  const pem = readFileSync(PUBLIC_KEY_PATH, 'utf-8');
  _publicKey = await importSPKI(pem, 'RS256');
  return _publicKey;
}

/**
 * JWK形式で公開鍵をエクスポート
 */
export async function getPublicKeyAsJwk(): Promise<object> {
  const publicKey = await getPublicKey();
  const jwk = await exportJWK(publicKey);
  return {
    ...jwk,
    kid: getKeyId(),
    use: 'sig',
    alg: 'RS256',
  };
}

// トークンペイロード
export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
}

export interface IdTokenPayload extends TokenPayload {
  nonce?: string;
  auth_time?: number;
}

/**
 * アクセストークン（JWT/RS256）を生成
 */
export async function generateAccessToken(
  payload: TokenPayload,
  clientId?: string,
  scope?: string
): Promise<string> {
  const privateKey = await getPrivateKey();
  const issuer = getIssuer();

  const builder = new SignJWT({
    ...payload,
    scope: scope || 'openid profile email',
  })
    .setProtectedHeader({ alg: 'RS256', kid: getKeyId() })
    .setIssuedAt()
    .setIssuer(issuer)
    .setSubject(payload.userId)
    .setExpirationTime(ACCESS_TOKEN_EXPIRES_IN);

  if (clientId) {
    builder.setAudience(clientId);
  }

  return builder.sign(privateKey);
}

/**
 * ID Token（OIDC）を生成
 */
export async function generateIdToken(
  payload: IdTokenPayload,
  clientId: string,
  nonce?: string
): Promise<string> {
  const privateKey = await getPrivateKey();
  const issuer = getIssuer();

  const tokenPayload: Record<string, unknown> = {
    sub: payload.userId,
    email: payload.email,
    roles: payload.roles,
    auth_time: payload.auth_time || Math.floor(Date.now() / 1000),
  };

  if (nonce) {
    tokenPayload.nonce = nonce;
  }

  return new SignJWT(tokenPayload)
    .setProtectedHeader({ alg: 'RS256', kid: getKeyId() })
    .setIssuedAt()
    .setIssuer(issuer)
    .setSubject(payload.userId)
    .setAudience(clientId)
    .setExpirationTime(ID_TOKEN_EXPIRES_IN)
    .sign(privateKey);
}

/**
 * アクセストークンを検証
 */
export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const publicKey = await getPublicKey();
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: getIssuer(),
    });
    return {
      userId: payload.sub as string || payload.userId as string,
      email: payload.email as string,
      roles: payload.roles as string[] || [],
    };
  } catch {
    return null;
  }
}

/**
 * ID Tokenを検証
 */
export async function verifyIdToken(
  token: string,
  clientId: string,
  nonce?: string
): Promise<IdTokenPayload | null> {
  try {
    const publicKey = await getPublicKey();
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: getIssuer(),
      audience: clientId,
    });

    if (nonce && payload.nonce !== nonce) {
      return null;
    }

    return {
      userId: payload.sub as string,
      email: payload.email as string,
      roles: payload.roles as string[] || [],
      nonce: payload.nonce as string | undefined,
      auth_time: payload.auth_time as number | undefined,
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
 * 認可コード（Opaque Token）を生成
 */
export function generateAuthorizationCode(): string {
  return randomBytes(32).toString('hex');
}

/**
 * クライアントシークレットを生成
 */
export function generateClientSecret(): string {
  return randomBytes(48).toString('hex');
}

/**
 * リフレッシュトークンの有効期限を計算
 */
export function getRefreshTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);
  return expiry;
}

/**
 * 認可コードの有効期限を計算
 */
export function getAuthCodeExpiry(): Date {
  return new Date(Date.now() + AUTH_CODE_EXPIRES_IN_SECONDS * 1000);
}

/**
 * PKCE: code_verifier からcode_challenge を生成
 */
export function generateCodeChallenge(codeVerifier: string): string {
  return createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
}

/**
 * PKCE: code_challengeを検証
 */
export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: 'S256' | 'plain' = 'S256'
): boolean {
  if (method === 'plain') {
    return codeVerifier === codeChallenge;
  }
  const computed = generateCodeChallenge(codeVerifier);
  return computed === codeChallenge;
}

/**
 * クライアント認証を検証（Argon2ハッシュ対応）
 */
export async function verifyClientCredentials(
  providedSecret: string,
  storedSecretHash: string
): Promise<boolean> {
  try {
    // Argon2ハッシュの場合
    if (storedSecretHash.startsWith('$argon2')) {
      return await argon2.verify(storedSecretHash, providedSecret);
    }
    // SHA256ハッシュの場合（後方互換性）
    const hash = createHash('sha256').update(providedSecret).digest('hex');
    return hash === storedSecretHash;
  } catch {
    return false;
  }
}

/**
 * クライアントシークレットをハッシュ化
 */
export function hashClientSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

// 後方互換性のため、レガシーHS256もサポート
const LEGACY_JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-production'
);

/**
 * レガシーアクセストークン（HS256）を生成
 */
export async function generateLegacyAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRES_IN)
    .sign(LEGACY_JWT_SECRET);
}

/**
 * レガシーアクセストークン（HS256）を検証
 */
export async function verifyLegacyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, LEGACY_JWT_SECRET);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      roles: payload.roles as string[],
    };
  } catch {
    return null;
  }
}
