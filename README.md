# auth - OAuth 2.0 / OpenID Connect Authentication Service

[日本語版はこちら](#auth---認証基盤oauth-20--openid-connect)

## Overview

OAuth 2.0 / OpenID Connect (OIDC) authentication service built with Next.js 15. Acts as an **OpenID Provider (OP)** for multiple internal applications, providing Single Sign-On (SSO) and centralized user management.

### Key Features

- **OAuth 2.0 / OpenID Connect**
  - Authorization Code Flow with **PKCE (S256 only)**
  - Refresh Token grant (rotation enabled)
  - OIDC Discovery (`/.well-known/openid-configuration`)
  - JWKS (`/.well-known/jwks.json`)
  - Token Revocation (RFC 7009)
  - Token Introspection (RFC 7662)

- **Authentication & Tokens**
  - Access token: **JWT (RS256)**, 15-minute expiration
  - ID token: JWT (RS256), 1-hour expiration
  - Refresh token: Opaque, 30-day expiration with rotation
  - Password hashing: **argon2id**
  - Account lockout: 5 failures → 15-minute lock
  - HttpOnly + Secure + SameSite=Lax cookies

- **User & Access Management**
  - User registration with email verification
  - Google SSO
  - RBAC (GlobalRole + Permissions)
  - Per-application authorization (`UserApplicationAccess`)
  - Organization / position management

- **Production Operations**
  - Redis-based distributed rate limiting (`ioredis`)
  - SecurityLog audit trail (login, token issued/refreshed/revoked, etc.)
  - CORS whitelist (no wildcard)
  - systemd + Nginx HTTPS reverse proxy

### Tech Stack

- **Framework**: Next.js 15.5 (App Router) / React 19 / TypeScript 5
- **Database**: PostgreSQL 16+ via Prisma 6
- **Cache / rate limit**: Redis 7+
- **Auth libraries**: `jose` (RS256), `argon2`
- **UI**: Tailwind CSS + shadcn/ui

## Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+ (with `requirepass`)
- Nginx (HTTPS reverse proxy)

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure env (see docs/SETUP.md for full template)
# .env.local: DATABASE_URL, OAUTH_ISSUER, OAUTH_KEY_ID,
#             CORS_ALLOWED_ORIGINS, LEGACY_API_ENABLED=false,
#             REDIS_URL, JWT_SECRET, ENCRYPTION_SECRET

# 3. Migrate
npx prisma migrate deploy
npx prisma generate

# 4. Build & run
npm run build
npm run start  # listens on port 3019
```

Detailed setup steps for production (systemd, Nginx, Redis, RSA keys) are in [`docs/SETUP.md`](./docs/SETUP.md).

## Admin Panel

Access at `https://<your-auth-domain>/login`:

| Page | URL | Required role |
|------|-----|---------------|
| Dashboard | `/dashboard` | any |
| Profile | `/profile` | any |
| Users | `/users` | admin |
| Organizations / Positions | `/organizations`, `/positions` | admin |
| Applications (OAuth clients) | `/applications` | admin |
| System settings (Google SSO, SES, tokens) | `/settings` | admin |
| Guide | `/guide` | admin |

## OIDC Integration (Relying Party example)

```typescript
// NextAuth.js v5 / Auth.js
import NextAuth from "next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    {
      id: "auth-provider",
      name: "Auth Provider",
      type: "oidc",
      issuer: process.env.AUTH_PROVIDER_ISSUER,        // https://auth.senku.work
      clientId: process.env.AUTH_PROVIDER_ID,          // registered via Admin > Applications
      clientSecret: process.env.AUTH_PROVIDER_SECRET,
      authorization: { params: { scope: "openid profile email custom" } },
    },
  ],
});
```

After registering the client, grant the user access via Admin Panel → Users → Application Access (`UserApplicationAccess`).

## API Reference (summary)

> Detailed request/response schema is in [`docs/API.md`](./docs/API.md).

### Public OAuth 2.0 / OIDC

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/.well-known/openid-configuration` | OIDC Discovery |
| GET | `/.well-known/jwks.json` | JSON Web Key Set |
| GET | `/oauth/authorize` | Authorization endpoint (PKCE S256) |
| POST | `/oauth/token` | Token endpoint (rate limited: 20/min/IP) |
| GET | `/oauth/userinfo` | UserInfo endpoint |
| POST | `/oauth/revoke` | Token revocation (RFC 7009) |
| POST | `/oauth/introspect` | Token introspection (RFC 7662) |

### Public callback endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/google/callback` | Google OAuth callback |
| GET | `/api/auth/verify-email` | Email verification link landing |

### Admin-internal (same-origin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/auth/login` | Admin panel login |
| POST | `/api/admin/auth/register` | Self-registration |
| POST | `/api/admin/auth/logout` | Admin panel logout |
| POST | `/api/admin/auth/refresh` | Refresh admin token |
| GET | `/api/admin/auth/me` | Current admin user |
| GET | `/api/admin/auth/google` | Begin Google SSO |

> **Note**: Legacy `/api/auth/{login,logout,me,refresh,verify,register,google,google/status}` return **410 Gone** (`LEGACY_API_ENABLED=false`). Use OAuth/OIDC endpoints for external integrations.

## Documentation

- [`docs/document.md`](./docs/document.md) - System overview
- [`docs/API.md`](./docs/API.md) - Complete API reference
- [`docs/SECURITY.md`](./docs/SECURITY.md) - Security design & operations
- [`docs/SETUP.md`](./docs/SETUP.md) - Detailed setup (PostgreSQL, Redis, systemd, Nginx)

## License

MIT License

---

# auth - 認証基盤（OAuth 2.0 / OpenID Connect）

[English version is above](#auth---oauth-20--openid-connect-authentication-service)

## 概要

Next.js 15 で構築された **OAuth 2.0 / OpenID Connect (OIDC) 認証基盤**。複数の社内アプリケーションに対する **OpenID Provider (OP)** として機能し、シングルサインオン（SSO）と一元的なユーザー管理を提供します。

### 主な機能

- **OAuth 2.0 / OpenID Connect**
  - Authorization Code Flow + **PKCE（S256のみ）**
  - Refresh Token Grant（ローテーション有効）
  - OIDC Discovery、JWKS、Revocation (RFC 7009)、Introspection (RFC 7662)

- **認証・トークン**
  - アクセストークン: **JWT (RS256)**、有効期限15分
  - ID Token: JWT (RS256)、有効期限1時間
  - リフレッシュトークン: Opaque、30日、ローテーション
  - パスワード: **argon2id**
  - アカウントロック: 5回失敗で15分ロック
  - Cookie: HttpOnly + Secure + SameSite=Lax

- **ユーザー・アクセス管理**
  - メール検証付き新規登録、Google SSO
  - RBAC（GlobalRole + Permissions）
  - アプリ単位の利用許可（`UserApplicationAccess`）
  - 組織・役職管理

- **本番運用機能**
  - Redis 分散レートリミット (`ioredis`)
  - SecurityLog による監査（login / token issued / refreshed / revoked 等）
  - CORS ホワイトリスト（ワイルドカード不可）
  - systemd + Nginx HTTPS リバプロ

### 技術スタック

- Next.js 15.5 / React 19 / TypeScript 5
- PostgreSQL 16+（Prisma 6）
- Redis 7+
- `jose`（RS256 JWT）、`argon2`
- Tailwind CSS + shadcn/ui

## 前提条件

- Node.js 20+
- PostgreSQL 16+
- Redis 7+（`requirepass` 設定）
- Nginx（HTTPS リバプロ）

## クイックスタート

```bash
# 1. 依存導入
npm install

# 2. 環境変数（詳細は docs/SETUP.md）
# .env.local: DATABASE_URL, OAUTH_ISSUER, OAUTH_KEY_ID,
#             CORS_ALLOWED_ORIGINS, LEGACY_API_ENABLED=false,
#             REDIS_URL, JWT_SECRET, ENCRYPTION_SECRET

# 3. マイグレーション
npx prisma migrate deploy
npx prisma generate

# 4. ビルド & 起動
npm run build
npm run start  # port 3019
```

本番構築（systemd、Nginx、Redis、RSA鍵）は [`docs/SETUP.md`](./docs/SETUP.md) を参照。

## 管理画面

`https://<your-auth-domain>/login` からアクセス：

| ページ | URL | 必要ロール |
|--------|-----|------------|
| ダッシュボード | `/dashboard` | 全員 |
| プロフィール | `/profile` | 全員 |
| ユーザー管理 | `/users` | admin |
| 組織・役職 | `/organizations`, `/positions` | admin |
| アプリケーション（OAuthクライアント） | `/applications` | admin |
| システム設定（Google SSO, SES, トークン） | `/settings` | admin |
| 使い方 | `/guide` | admin |

## OIDC 連携（クライアント側の設定例）

```typescript
// NextAuth.js v5 / Auth.js
import NextAuth from "next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    {
      id: "auth-provider",
      name: "Auth Provider",
      type: "oidc",
      issuer: process.env.AUTH_PROVIDER_ISSUER,        // https://auth.senku.work
      clientId: process.env.AUTH_PROVIDER_ID,          // 管理画面 > アプリケーションで登録
      clientSecret: process.env.AUTH_PROVIDER_SECRET,
      authorization: { params: { scope: "openid profile email custom" } },
    },
  ],
});
```

クライアント登録後、管理画面 → ユーザー管理 から該当ユーザーに **アプリ利用権限** を付与（`UserApplicationAccess`）。

## API リファレンス（概要）

> 詳細は [`docs/API.md`](./docs/API.md) を参照。

### 外部公開：OAuth 2.0 / OIDC

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/.well-known/openid-configuration` | OIDC Discovery |
| GET | `/.well-known/jwks.json` | JWKS |
| GET | `/oauth/authorize` | 認可エンドポイント（PKCE S256） |
| POST | `/oauth/token` | トークン発行（レート制限 20req/min/IP） |
| GET | `/oauth/userinfo` | UserInfo |
| POST | `/oauth/revoke` | トークン無効化 (RFC 7009) |
| POST | `/oauth/introspect` | トークン状態確認 (RFC 7662) |

### 外部公開：コールバック

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/auth/google/callback` | Google OAuth コールバック |
| GET | `/api/auth/verify-email` | メール検証リンクの戻り |

### 管理画面内部（同オリジンのみ）

| Method | Endpoint | 説明 |
|--------|----------|------|
| POST | `/api/admin/auth/login` | 管理画面ログイン |
| POST | `/api/admin/auth/register` | 自己登録 |
| POST | `/api/admin/auth/logout` | 管理画面ログアウト |
| POST | `/api/admin/auth/refresh` | 管理画面トークン更新 |
| GET | `/api/admin/auth/me` | ログイン中ユーザー情報 |
| GET | `/api/admin/auth/google` | Google SSO 開始 |

> **重要**: 旧 `/api/auth/{login,logout,me,refresh,verify,register,google,google/status}` は **410 Gone** (`LEGACY_API_ENABLED=false`)。外部連携は OAuth/OIDC エンドポイントを使用してください。

## ドキュメント

- [`docs/document.md`](./docs/document.md) - システム概要
- [`docs/API.md`](./docs/API.md) - 完全な API リファレンス
- [`docs/SECURITY.md`](./docs/SECURITY.md) - セキュリティ設計と運用
- [`docs/SETUP.md`](./docs/SETUP.md) - 詳細セットアップ（PostgreSQL、Redis、systemd、Nginx）

## ライセンス

MIT License
