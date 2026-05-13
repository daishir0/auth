# セキュリティガイド

## 概要

`auth.senku.work` のセキュリティ設計と運用ガイド。本書は **2026-05 の OAuth2 強化フェーズ** 以降の最新仕様。

---

## 認証・トークン設計

### トークン仕様

| 要素 | 実装 |
|------|------|
| アクセストークン | **JWT (RS256)** + jose ライブラリ、`exp=15min` |
| ID Token (OIDC) | JWT (RS256)、`exp=1h`、nonce 検証 |
| リフレッシュトークン | Opaque 32B hex、DB 管理、`exp=30d`、ローテーション |
| 認可コード | 32B hex、`exp=10min`、PKCE 必須（S256） |
| パスワードハッシュ | **argon2id** |
| クライアントシークレットハッシュ | Argon2id |
| トークン保存 | HttpOnly + Secure + SameSite=Lax Cookie |
| 鍵管理 | RSA 2048-bit、`keys/private.pem` + JWK 公開 (`/.well-known/jwks.json`) |
| `kid` (Key ID) | `OAUTH_KEY_ID` 環境変数（例: `auth-key-001`） |

> **2026-05 で旧 HS256 経路 (`lib/auth.ts`) は完全廃止**。すべて RS256 統一。

### Cookie 属性

- `Secure`: 必須（HTTPSのみ）
- `HttpOnly`: 必須（XSS 対策）
- `SameSite=Lax`: 標準
- `Path=/`、ドメイン指定なし

---

## 認可・アクセス制御

### RBAC

- `GlobalRole`（`super_admin`, `admin`, `user` 等）+ `GlobalRolePermission`
- `UserGlobalRole` で User とロールを紐付け
- 管理画面の各メニュー表示は `super_admin`/`admin` ロールでガード

### アプリ単位の利用許可

`UserApplicationAccess` テーブルで「ユーザー × OAuthClient」の許可を管理。`/oauth/authorize` で許可されていないクライアントへの認可は `access_denied`。

---

## OAuth 2.0 / OIDC

### サポート機能

| 機能 | 実装 |
|------|------|
| Authorization Code Flow | ✓ |
| PKCE | ✓ S256 のみ（plain 廃止） |
| Refresh Token (ローテーション) | ✓ |
| Discovery | ✓ `/.well-known/openid-configuration` |
| JWKS | ✓ `/.well-known/jwks.json` |
| Revocation (RFC 7009) | ✓ |
| Introspection (RFC 7662) | ✓ |
| Client Credentials Flow | 未実装 |
| 動的クライアント登録 | 未実装 |
| Implicit Flow | 未対応（脆弱性のため） |

### `LEGACY_API_ENABLED=false`

旧 REST API (`/api/auth/{login,logout,me,refresh,verify}`) は 410 Gone。代替:
- 外部クライアント → OIDC (`/oauth/*`)
- auth 管理画面内部 → `/api/admin/auth/*`

---

## CORS

**ホワイトリスト方式** (`lib/cors.ts`)。ワイルドカード `*` 禁止。

設定:
```env
CORS_ALLOWED_ORIGINS="https://policy-manager.senku.work,https://policy-manager-dev.senku.work"
```

未許可オリジンには `Access-Control-Allow-Origin` ヘッダ自体を返さない。

---

## レート制限

**Redis** ベース (`lib/rate-limit.ts`) で分散対応。`ioredis` 経由で localhost Redis に接続。

| エンドポイント | 上限 |
|----------------|------|
| `/oauth/token` | 20 req/min/IP |

Redis 接続失敗時は **fail-open**（rate limit が機能しないだけでサービスは継続）。

---

## アカウントロック

| 項目 | 値 |
|------|-----|
| 失敗閾値 | 5 回 |
| ロック期間 | 15 分 |
| 管理画面ログイン (`/api/admin/auth/login`) | 対象 |

DB: `UserCredential.failedLoginAttempts`, `lockedUntil`

---

## 監査ログ (SecurityLog)

| アクション | 記録タイミング |
|------------|----------------|
| `login_success` / `login_failed` | `/api/admin/auth/login` |
| `oauth_authorize` | `/oauth/authorize` 認可コード発行 |
| `oauth_token_issued` | Authorization Code Grant 成功 |
| `oauth_token_refreshed` | Refresh Token Grant 成功 |
| `oauth_token_revoked` | `/oauth/revoke` 成功 |
| 管理者操作（アプリ作成・アクセス権付与等） | 各管理API |

記録項目: `userId`, `action`, `ipAddress`, `userAgent`, `details` (JSON)

PII（トークン全文）は記録しない。

---

## シークレット管理

### 環境変数（`.env.local`、`.gitignore` 必須）

| 変数 | 用途 |
|------|------|
| `DATABASE_URL` | PostgreSQL 接続情報 |
| `OAUTH_ISSUER` | 公開 issuer URL |
| `OAUTH_KEY_ID` | JWK kid |
| `ENCRYPTION_SECRET` | DB暗号化用（Google SSO secret 等） |
| `CORS_ALLOWED_ORIGINS` | カンマ区切りホワイトリスト |
| `LEGACY_API_ENABLED` | `false` |
| `REDIS_URL` | Redis 接続（password付き URL） |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | 旧HS256用（互換のため残るが未使用） |

### RSA 鍵

`keys/private.pem` は自動生成 (`generateAndSaveKeyPairSync()`)、`.gitignore` 必須。

### クライアントシークレット再発行

`scripts/rotate-secrets.mjs` 実行で OAuthClient レコードを更新。Argon2id ハッシュは DB に、平文は実行者がアプリ側 `.env` に反映。

---

## 本番運用チェックリスト

- [ ] `NODE_ENV=production` 確認
- [ ] `LEGACY_API_ENABLED=false`
- [ ] `CORS_ALLOWED_ORIGINS` がホワイトリスト（`*` 禁止）
- [ ] `JWT_SECRET`, `ENCRYPTION_SECRET` が仮値ではない
- [ ] Redis `requirepass` 設定 + `bind 127.0.0.1`
- [ ] systemd `auth.service` の `After=redis-server.service`
- [ ] PostgreSQL バックアップ（policy-manager 同等の運用）
- [ ] `/keys/` ディレクトリのバックアップ（紛失すると既存トークン全失効）
- [ ] HTTPS 必須、HTTP 受付なし
- [ ] SecurityLog の保管期間ポリシー策定

---

## 既知の制限

- MFA: スキーマあり (`mfaEnabled`, `mfaSecret`) だが、未実装
- パスワードリセット: メール検証フローは実装、運用テスト未実施
- Email Verification: 必須化されていない（emailVerified=true で初期化される）

---

## インシデント時の対応

| 事象 | 対応 |
|------|------|
| RSA 秘密鍵漏洩 | `keys/` を削除→自動再生成→全 access_token/refresh_token 無効化（DB Cleanup）→ 全ユーザー再ログイン |
| クライアントシークレット漏洩 | `scripts/rotate-secrets.mjs` 実行 → 該当アプリ `.env` 更新 → restart |
| アカウント乗っ取り疑い | `SecurityLog` を `userId` で精査 → 該当ユーザーの RefreshToken 削除 → password reset |
| Redis 障害 | rate-limit のみ無効化（fail-open）、auth 自体は継続 |
