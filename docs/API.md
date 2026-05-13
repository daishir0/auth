# API リファレンス

## 概要

`auth.senku.work` の HTTP API 仕様書です。OAuth 2.0 / OpenID Connect (OIDC) エンドポイント、管理画面内部API、外部公開コールバックの 3 種類で構成されます。

**Base URL（本番）**: `https://auth.senku.work`
**Base URL（開発）**: `http://localhost:3019`

---

## エンドポイント分類

| 分類 | パス接頭辞 | 用途 | 公開範囲 |
|------|------------|------|----------|
| **OAuth/OIDC** | `/oauth/*`, `/.well-known/*` | 外部 OAuth クライアント連携 | 外部公開 |
| **外部コールバック** | `/api/auth/google/callback`, `/api/auth/verify-email` | 外部 IdP / メールリンクの戻り | 外部公開 |
| **管理画面内部API** | `/api/admin/auth/*` | auth 自身の管理画面用 | 内部（同オリジン） |
| **管理API** | `/api/admin/*`, `/api/users` 等 | 管理画面の各種CRUD | 内部（認証必須） |

> **注意**: 旧 `/api/auth/{login,logout,me,refresh,verify,register,google,google/status}` は 2026-05 で **410 Gone**（`LEGACY_API_ENABLED=false`）。

---

## OAuth 2.0 / OIDC エンドポイント

### Discovery

#### `GET /.well-known/openid-configuration`

OIDC 設定の自動取得。

```json
{
  "issuer": "https://auth.senku.work",
  "authorization_endpoint": "https://auth.senku.work/oauth/authorize",
  "token_endpoint": "https://auth.senku.work/oauth/token",
  "userinfo_endpoint": "https://auth.senku.work/oauth/userinfo",
  "jwks_uri": "https://auth.senku.work/.well-known/jwks.json",
  "revocation_endpoint": "https://auth.senku.work/oauth/revoke",
  "introspection_endpoint": "https://auth.senku.work/oauth/introspect",
  "scopes_supported": ["openid","profile","email","offline_access","custom"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code","refresh_token"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic","client_secret_post"]
}
```

#### `GET /.well-known/jwks.json`

ID Token / Access Token の署名検証用公開鍵（JWK Set, RS256）。

### Authorization

#### `GET /oauth/authorize`

認可リクエスト（Authorization Code Flow with PKCE）。

| クエリ | 必須 | 説明 |
|--------|:--:|------|
| `response_type` | ✓ | `code` 固定 |
| `client_id` | ✓ | OAuth クライアント ID |
| `redirect_uri` | ✓ | DB登録の URI と完全一致必須 |
| `scope` | ✓ | `openid profile email` 等。`custom` で組織情報も付与 |
| `state` | 推奨 | CSRF 対策 |
| `code_challenge` | ✓ | PKCE。S256 のみサポート |
| `code_challenge_method` | ✓ | `S256` |
| `nonce` | 推奨 | id_token replay 防止 |

応答: `302 → {redirect_uri}?code=xxx&state=xxx`

未認証時: `302 → /login`、未許可ユーザー: `302 → /oauth/error?error=access_denied`

### Token

#### `POST /oauth/token`

| grant_type | 用途 |
|------------|------|
| `authorization_code` | 認可コード → access/id/refresh token |
| `refresh_token` | refresh token → 新トークン（ローテーション） |

**Form Body 例（authorization_code）**:
```
grant_type=authorization_code
&code=...
&client_id=<CLIENT_ID>
&client_secret=<CLIENT_SECRET>
&code_verifier=...
&redirect_uri=https://app.example.com/api/auth/callback/auth-provider
```

応答:
```json
{
  "access_token": "<RS256 JWT, exp 15min>",
  "id_token": "<RS256 JWT, exp 1h>",
  "refresh_token": "<opaque hex, exp 30d>",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "openid profile email custom"
}
```

レート制限: 20 req/min/IP（Redis）

### UserInfo

#### `GET /oauth/userinfo`

```
Authorization: Bearer <access_token>
```

応答（claims は scope に応じて返却）:
```json
{
  "sub": "<userId>",
  "email": "user@example.com",
  "email_verified": true,
  "name": "山田太郎",
  "picture": "https://...",
  "roles": ["super_admin"],
  "permissions": ["...","..."],
  "primary_organization": { "id":"...","name":"...","code":"..." },
  "organizations": [ /* custom スコープで返却 */ ]
}
```

### Revoke (RFC 7009)

#### `POST /oauth/revoke`

トークン（access_token / refresh_token）を即時無効化。

```
token=...&token_type_hint=access_token
&client_id=<CLIENT_ID>&client_secret=<CLIENT_SECRET>
```

応答: `200 OK`（存在しないトークンでも 200）

### Introspect (RFC 7662)

#### `POST /oauth/introspect`

トークンの状態確認。

```
token=...&client_id=<CLIENT_ID>&client_secret=<CLIENT_SECRET>
```

応答:
```json
{ "active": true, "sub": "...", "scope": "...", "exp": 1234567890, "iat": ... }
```

---

## 外部公開コールバック

### `GET /api/auth/google/callback`

Google OAuth の戻り URL。Google Cloud Console に登録された redirect URI と一致する必要あり。

### `GET /api/auth/verify-email?token=...`

メール検証リンクの着地。トークンを検証して User.emailVerified を更新。

---

## 管理画面内部 API (`/api/admin/auth/*`)

auth 自身のフロントエンドからのみ利用。**外部クライアントは OAuth 経路を使うこと**。

| Method | Path | 用途 |
|--------|------|------|
| POST | `/api/admin/auth/login` | メール/パスワードログイン（cookie発行） |
| POST | `/api/admin/auth/register` | 自己登録（メール検証メール送信） |
| POST | `/api/admin/auth/logout` | ログアウト（cookie削除） |
| POST | `/api/admin/auth/refresh` | アクセストークン更新（管理画面用） |
| POST | `/api/admin/auth/verify` | アクセストークン検証 |
| GET | `/api/admin/auth/me` | 自分の情報 |
| GET | `/api/admin/auth/me/applications` | 自分が許可されたアプリ一覧 |
| GET | `/api/admin/auth/google` | Google OAuth 開始 → Google へ redirect |
| GET | `/api/admin/auth/google/status` | Google SSO 有効か |

**ログイン応答（成功）**:
```http
HTTP/2 200
Set-Cookie: access_token=<RS256 JWT>; HttpOnly; Secure; SameSite=lax; Max-Age=3600
Set-Cookie: refresh_token=<opaque>; HttpOnly; Secure; SameSite=lax; Max-Age=2592000

{ "message": "Login successful", "user": { "id":"...", "email":"...", "roles":["..."] } }
```

**ログイン失敗**: `400 { "error": "Invalid email or password" }`、5回失敗で **15分ロック**

---

## CORS

`CORS_ALLOWED_ORIGINS` 環境変数で **ホワイトリスト方式**。許可外オリジンは `Access-Control-Allow-Origin` ヘッダを返さない（ワイルドカード `*` 不可）。

現在の許可:
- `https://policy-manager.senku.work`
- `https://policy-manager-dev.senku.work`

---

## レート制限

| パス | 上限 | 実装 |
|------|------|------|
| `/oauth/token` | 20 req/min/IP | Redis (`lib/rate-limit.ts`) |

429 応答時:
```http
HTTP/2 429
Retry-After: 42

{ "error": "rate_limit_exceeded", "retry_after": 42 }
```

---

## 認証フロー (RP視点・PKCE+OIDC)

1. RP → 302 → `GET /oauth/authorize?response_type=code&client_id=...&code_challenge=...`
2. OP `/login` で認証 → 認可コード発行 → RPコールバックへリダイレクト
3. RP → `POST /oauth/token`（code_verifier付き）→ access/id/refresh token
4. RP → `GET /oauth/userinfo` で claims 取得 → セッション確立
5. RP ログアウト時 → `POST /oauth/revoke`

詳細シーケンスは Papernote「20260513OAuth2とOIDCの関係性・シーケンス図解説」を参照。
