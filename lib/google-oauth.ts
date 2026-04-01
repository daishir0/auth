import { getGoogleSsoSettings } from '@/lib/settings';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export interface GoogleUserInfo {
  sub: string;        // Google ユーザーID
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token: string;
  refresh_token?: string;
}

/**
 * Google OAuth認可URLを生成
 */
export async function getGoogleAuthUrl(
  redirectUri: string,
  state: string
): Promise<string | null> {
  const settings = await getGoogleSsoSettings();

  if (!settings.enabled || !settings.clientId) {
    return null;
  }

  const params = new URLSearchParams({
    client_id: settings.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * 認可コードをトークンに交換
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse | null> {
  const settings = await getGoogleSsoSettings();

  if (!settings.clientId || !settings.clientSecret) {
    console.error('Google SSO settings not configured');
    return null;
  }

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Token exchange failed:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Token exchange error:', error);
    return null;
  }
}

/**
 * アクセストークンからユーザー情報を取得
 */
export async function getGoogleUserInfo(
  accessToken: string
): Promise<GoogleUserInfo | null> {
  try {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to get user info:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Get user info error:', error);
    return null;
  }
}

/**
 * ID TokenからPayloadをデコード（署名検証なし、userinfoで確認するため）
 */
export function decodeIdToken(idToken: string): { email?: string; sub?: string; name?: string } | null {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return payload;
  } catch {
    return null;
  }
}

/**
 * stateトークンを生成（CSRF対策）
 */
export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Google OAuthのリダイレクトURIを取得
 */
export function getGoogleRedirectUri(baseUrl: string): string {
  return `${baseUrl}/api/auth/google/callback`;
}
