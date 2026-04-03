import prisma from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encryption';

// 設定キー
export const SETTINGS_KEYS = {
  // Google SSO設定
  GOOGLE_SSO_ENABLED: 'google_sso_enabled',
  GOOGLE_SSO_CLIENT_ID: 'google_sso_client_id',
  GOOGLE_SSO_CLIENT_SECRET: 'google_sso_client_secret',
  // トークン期限設定
  ACCESS_TOKEN_EXPIRES_MINUTES: 'access_token_expires_minutes',
  REFRESH_TOKEN_EXPIRES_DAYS: 'refresh_token_expires_days',
  // Amazon SES設定
  SES_ENABLED: 'ses_enabled',
  SES_REGION: 'ses_region',
  SES_ACCESS_KEY_ID: 'ses_access_key_id',
  SES_SECRET_ACCESS_KEY: 'ses_secret_access_key',
  SES_FROM_ADDRESS: 'ses_from_address',
} as const;

// デフォルト値
export const TOKEN_DEFAULTS = {
  ACCESS_TOKEN_EXPIRES_MINUTES: 15,
  REFRESH_TOKEN_EXPIRES_DAYS: 30,
} as const;

// 暗号化が必要なキーのリスト
const ENCRYPTED_KEYS = [
  SETTINGS_KEYS.GOOGLE_SSO_CLIENT_SECRET,
  SETTINGS_KEYS.SES_SECRET_ACCESS_KEY,
];

/**
 * 設定値を取得
 */
export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key },
  });

  if (!setting) {
    return null;
  }

  // 暗号化された値の場合は復号化
  if (setting.encrypted) {
    try {
      return decrypt(setting.value);
    } catch (error) {
      console.error(`Failed to decrypt setting ${key}:`, error);
      return null;
    }
  }

  return setting.value;
}

/**
 * 設定値を保存
 */
export async function setSetting(key: string, value: string): Promise<void> {
  const shouldEncrypt = ENCRYPTED_KEYS.includes(key as typeof ENCRYPTED_KEYS[number]);
  const storedValue = shouldEncrypt ? encrypt(value) : value;

  await prisma.systemSetting.upsert({
    where: { key },
    update: {
      value: storedValue,
      encrypted: shouldEncrypt,
    },
    create: {
      key,
      value: storedValue,
      encrypted: shouldEncrypt,
    },
  });
}

/**
 * 設定値を削除
 */
export async function deleteSetting(key: string): Promise<void> {
  await prisma.systemSetting.delete({
    where: { key },
  }).catch(() => {
    // 存在しない場合は無視
  });
}

/**
 * Google SSO設定を取得
 */
export async function getGoogleSsoSettings(): Promise<{
  enabled: boolean;
  clientId: string | null;
  clientSecret: string | null;
}> {
  const [enabled, clientId, clientSecret] = await Promise.all([
    getSetting(SETTINGS_KEYS.GOOGLE_SSO_ENABLED),
    getSetting(SETTINGS_KEYS.GOOGLE_SSO_CLIENT_ID),
    getSetting(SETTINGS_KEYS.GOOGLE_SSO_CLIENT_SECRET),
  ]);

  return {
    enabled: enabled === 'true',
    clientId,
    clientSecret,
  };
}

/**
 * Google SSOが有効かどうかを確認
 */
export async function isGoogleSsoEnabled(): Promise<boolean> {
  const settings = await getGoogleSsoSettings();
  return settings.enabled && !!settings.clientId && !!settings.clientSecret;
}

/**
 * Google SSO設定を保存
 */
export async function setGoogleSsoSettings(settings: {
  enabled: boolean;
  clientId: string;
  clientSecret?: string;
}): Promise<void> {
  await Promise.all([
    setSetting(SETTINGS_KEYS.GOOGLE_SSO_ENABLED, settings.enabled.toString()),
    setSetting(SETTINGS_KEYS.GOOGLE_SSO_CLIENT_ID, settings.clientId),
    // clientSecretは空でなければ更新
    settings.clientSecret
      ? setSetting(SETTINGS_KEYS.GOOGLE_SSO_CLIENT_SECRET, settings.clientSecret)
      : Promise.resolve(),
  ]);
}

/**
 * トークン期限設定を取得
 */
export async function getTokenSettings(): Promise<{
  accessTokenExpiresMinutes: number;
  refreshTokenExpiresDays: number;
}> {
  const [accessMinutes, refreshDays] = await Promise.all([
    getSetting(SETTINGS_KEYS.ACCESS_TOKEN_EXPIRES_MINUTES),
    getSetting(SETTINGS_KEYS.REFRESH_TOKEN_EXPIRES_DAYS),
  ]);

  return {
    accessTokenExpiresMinutes: accessMinutes
      ? parseInt(accessMinutes, 10)
      : TOKEN_DEFAULTS.ACCESS_TOKEN_EXPIRES_MINUTES,
    refreshTokenExpiresDays: refreshDays
      ? parseInt(refreshDays, 10)
      : TOKEN_DEFAULTS.REFRESH_TOKEN_EXPIRES_DAYS,
  };
}

/**
 * トークン期限設定を保存
 */
export async function setTokenSettings(settings: {
  accessTokenExpiresMinutes: number;
  refreshTokenExpiresDays: number;
}): Promise<void> {
  await Promise.all([
    setSetting(
      SETTINGS_KEYS.ACCESS_TOKEN_EXPIRES_MINUTES,
      settings.accessTokenExpiresMinutes.toString()
    ),
    setSetting(
      SETTINGS_KEYS.REFRESH_TOKEN_EXPIRES_DAYS,
      settings.refreshTokenExpiresDays.toString()
    ),
  ]);
}

// ========================================
// Amazon SES設定
// ========================================

export interface SesSettings {
  enabled: boolean;
  region: string | null;
  accessKeyId: string | null;
  secretAccessKey: string | null;
  fromAddress: string | null;
}

/**
 * SES設定を取得
 */
export async function getSesSettings(): Promise<SesSettings> {
  const [enabled, region, accessKeyId, secretAccessKey, fromAddress] = await Promise.all([
    getSetting(SETTINGS_KEYS.SES_ENABLED),
    getSetting(SETTINGS_KEYS.SES_REGION),
    getSetting(SETTINGS_KEYS.SES_ACCESS_KEY_ID),
    getSetting(SETTINGS_KEYS.SES_SECRET_ACCESS_KEY),
    getSetting(SETTINGS_KEYS.SES_FROM_ADDRESS),
  ]);

  return {
    enabled: enabled === 'true',
    region,
    accessKeyId,
    secretAccessKey,
    fromAddress,
  };
}

/**
 * SESが有効かどうかを確認
 */
export async function isSesEnabled(): Promise<boolean> {
  const settings = await getSesSettings();
  return (
    settings.enabled &&
    !!settings.region &&
    !!settings.accessKeyId &&
    !!settings.secretAccessKey &&
    !!settings.fromAddress
  );
}

/**
 * SES設定を保存
 */
export async function setSesSettings(settings: {
  enabled: boolean;
  region: string;
  accessKeyId: string;
  secretAccessKey?: string;
  fromAddress: string;
}): Promise<void> {
  await Promise.all([
    setSetting(SETTINGS_KEYS.SES_ENABLED, settings.enabled.toString()),
    setSetting(SETTINGS_KEYS.SES_REGION, settings.region),
    setSetting(SETTINGS_KEYS.SES_ACCESS_KEY_ID, settings.accessKeyId),
    // secretAccessKeyは空でなければ更新
    settings.secretAccessKey
      ? setSetting(SETTINGS_KEYS.SES_SECRET_ACCESS_KEY, settings.secretAccessKey)
      : Promise.resolve(),
    setSetting(SETTINGS_KEYS.SES_FROM_ADDRESS, settings.fromAddress),
  ]);
}
