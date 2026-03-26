/**
 * OAuth関連用語のヘルプテキスト一元管理
 */

// 基本情報タブ
export const CLIENT_ID_HELP =
  'アプリケーションを識別する公開ID。OAuth認可リクエスト時に使用します';

export const CLIENT_SECRET_HELP =
  'サーバー間通信でアプリを認証する秘密鍵。外部に漏らさないでください';

// スコープ説明
export const SCOPE_HELP_TEXTS: Record<string, string> = {
  openid: 'ユーザーの一意な識別子（sub）を取得',
  profile: 'ユーザーの名前・プロフィール情報を取得',
  email: 'ユーザーのメールアドレスを取得',
  offline_access: 'リフレッシュトークンを発行し、長期間アクセス可能に',
  custom: 'アプリケーション固有のカスタム権限',
};

// Grant Types説明
export const GRANT_TYPE_HELP_TEXTS: Record<string, string> = {
  authorization_code:
    'ブラウザ経由でユーザー認証後にトークン取得（標準的な方式）',
  refresh_token: 'アクセストークン期限切れ時に再取得',
};

// 設定変更タブ
export const IS_ACTIVE_HELP =
  '無効化すると新規トークン発行が停止します。既存トークンは有効期限まで維持されます';

// セキュリティタブ
export const REGENERATE_SECRET_HELP =
  'シークレット漏洩時や定期ローテーション時に使用';

export const ACTIVE_TOKENS_HELP = '現在ログイン中のユーザー数に相当します';

/**
 * スコープの説明を取得（未知のスコープはデフォルトメッセージ）
 */
export function getScopeHelpText(scope: string): string {
  return SCOPE_HELP_TEXTS[scope] || 'カスタムスコープ';
}

/**
 * Grant Typeの説明を取得（未知のタイプはデフォルトメッセージ）
 */
export function getGrantTypeHelpText(grantType: string): string {
  return GRANT_TYPE_HELP_TEXTS[grantType] || '認可フロー';
}
