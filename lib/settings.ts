import prisma from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encryption';

// Google SSO設定のキー
export const SETTINGS_KEYS = {
  GOOGLE_SSO_ENABLED: 'google_sso_enabled',
  GOOGLE_SSO_CLIENT_ID: 'google_sso_client_id',
  GOOGLE_SSO_CLIENT_SECRET: 'google_sso_client_secret',
} as const;

// 暗号化が必要なキーのリスト
const ENCRYPTED_KEYS = [SETTINGS_KEYS.GOOGLE_SSO_CLIENT_SECRET];

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
