# auth - User Management Platform

## Overview

An integrated user management platform built with Next.js 15. Provides authentication, authorization, and user management features, serving as a common user infrastructure for multiple services.

### Key Features

- **Authentication**
  - User registration, login, logout
  - JWT (HS256) access tokens (15-minute expiration)
  - Opaque refresh tokens (30-day expiration)
  - Password hashing with argon2
  - Account lockout (30-minute lockout after 5 failures)

- **OAuth 2.0 / OpenID Connect (OIDC)**
  - Authorization Code Flow with PKCE
  - Client management
  - Scope-based authorization
  - Custom scopes (organization, profile information)

- **User Management**
  - User profiles (display name, avatar, hire date, etc.)
  - Many-to-many organization/position management
  - Global role and permission management
  - User search and filtering

- **Administration**
  - Organization hierarchy management
  - Position master management
  - Permission master management
  - Audit logging

### Tech Stack

- Next.js 15 / React 19
- PostgreSQL + Prisma ORM
- TypeScript
- Tailwind CSS

## Prerequisites

- Node.js 20+
- PostgreSQL 15+

## Installation

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd auth

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.local.example .env.local
# Edit .env.local with your settings

# 4. Run database migrations
npx prisma migrate deploy

# 5. Start development server
npm run dev
```

The server starts at http://localhost:3019

## Usage

### Admin Panel

Access the admin panel at `https://<your-auth-domain>/admin` to manage:
- Users and profiles
- Organizations and positions
- OAuth clients
- Roles and permissions

### OIDC Integration (Client Example)

```typescript
// auth.config.ts (NextAuth.js)
import NextAuth from "next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    {
      id: "auth-provider",
      name: "Auth Provider",
      type: "oidc",
      issuer: process.env.AUTH_PROVIDER_ISSUER,
      clientId: process.env.AUTH_PROVIDER_ID,
      clientSecret: process.env.AUTH_PROVIDER_SECRET,
      authorization: {
        params: { scope: "openid profile email custom" }
      },
    }
  ],
});
```

## API Reference

### Authentication APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| POST | /api/auth/refresh | Refresh tokens |
| GET | /api/auth/me | Get current user |

### OAuth 2.0 / OIDC Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /oauth/authorize | Authorization endpoint |
| POST | /oauth/token | Token endpoint |
| GET | /oauth/userinfo | UserInfo endpoint |
| GET | /.well-known/openid-configuration | OIDC Discovery |
| GET | /.well-known/jwks.json | JSON Web Key Set |

### User Management APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/users | List users |
| POST | /api/users | Create user |
| GET | /api/users/:id | Get user details |
| PATCH | /api/users/:id | Update user |
| DELETE | /api/users/:id | Delete user (soft) |

### Organization / Position APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/organizations | List organizations |
| POST | /api/organizations | Create organization |
| GET | /api/positions | List positions |
| POST | /api/positions | Create position |

## Notes

- **JWT_SECRET**: Use a strong random string (64+ characters)
- **HTTPS**: Required for production
- **Database**: Configure proper PostgreSQL backups

## License

MIT License

---

# auth - ユーザー管理基盤

## 概要

Next.js 15で構築された統合ユーザー管理基盤です。認証・認可・ユーザー管理機能を提供し、複数のサービスで共通のユーザー基盤として機能します。

### 主な機能

- **認証機能**
  - ユーザー登録・ログイン・ログアウト
  - JWT (HS256) アクセストークン（有効期限15分）
  - Opaqueリフレッシュトークン（有効期限30日）
  - argon2によるパスワードハッシュ化
  - アカウントロック機能（5回失敗で30分ロック）

- **OAuth 2.0 / OpenID Connect (OIDC)**
  - Authorization Code Flow with PKCE
  - クライアント管理機能
  - scopeベースの権限管理
  - カスタムスコープ（組織・プロフィール情報）

- **ユーザー管理**
  - ユーザープロフィール（表示名、アバター、入社日等）
  - 組織・役職の多対多管理
  - グローバルロール・権限管理
  - ユーザー検索・フィルタリング

- **管理機能**
  - 組織階層管理
  - 役職マスタ管理
  - 権限マスタ管理
  - 監査ログ

### 技術スタック

- Next.js 15 / React 19
- PostgreSQL + Prisma ORM
- TypeScript
- Tailwind CSS

## 前提条件

- Node.js 20+
- PostgreSQL 15+

## インストール

```bash
# 1. リポジトリをクローン
git clone <your-repo-url>
cd auth

# 2. 依存パッケージをインストール
npm install

# 3. 環境変数を設定
cp .env.local.example .env.local
# .env.local を編集

# 4. データベースマイグレーション
npx prisma migrate deploy

# 5. 開発サーバー起動
npm run dev
```

サーバーは http://localhost:3019 で起動します。

## 使い方

### 管理画面

`https://<your-auth-domain>/admin` から以下を管理できます：
- ユーザーとプロフィール
- 組織と役職
- OAuthクライアント
- ロールと権限

### OIDC連携（クライアント側の設定例）

```typescript
// auth.config.ts (NextAuth.js)
import NextAuth from "next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    {
      id: "auth-provider",
      name: "Auth Provider",
      type: "oidc",
      issuer: process.env.AUTH_PROVIDER_ISSUER,
      clientId: process.env.AUTH_PROVIDER_ID,
      clientSecret: process.env.AUTH_PROVIDER_SECRET,
      authorization: {
        params: { scope: "openid profile email custom" }
      },
    }
  ],
});
```

## APIリファレンス

### 認証API

| メソッド | エンドポイント | 説明 |
|----------|----------------|------|
| POST | /api/auth/register | 新規ユーザー登録 |
| POST | /api/auth/login | ログイン |
| POST | /api/auth/logout | ログアウト |
| POST | /api/auth/refresh | トークン更新 |
| GET | /api/auth/me | 現在のユーザー情報 |

### OAuth 2.0 / OIDC エンドポイント

| メソッド | エンドポイント | 説明 |
|----------|----------------|------|
| GET | /oauth/authorize | 認可エンドポイント |
| POST | /oauth/token | トークンエンドポイント |
| GET | /oauth/userinfo | ユーザー情報エンドポイント |
| GET | /.well-known/openid-configuration | OIDC Discovery |
| GET | /.well-known/jwks.json | JSON Web Key Set |

### ユーザー管理API

| メソッド | エンドポイント | 説明 |
|----------|----------------|------|
| GET | /api/users | ユーザー一覧 |
| POST | /api/users | ユーザー作成 |
| GET | /api/users/:id | ユーザー詳細 |
| PATCH | /api/users/:id | ユーザー更新 |
| DELETE | /api/users/:id | ユーザー削除（論理） |

### 組織・役職API

| メソッド | エンドポイント | 説明 |
|----------|----------------|------|
| GET | /api/organizations | 組織一覧 |
| POST | /api/organizations | 組織作成 |
| GET | /api/positions | 役職一覧 |
| POST | /api/positions | 役職作成 |

## 注意事項

- **JWT_SECRET**: 強力なランダム文字列を使用（64文字以上推奨）
- **HTTPS**: 本番環境では必須
- **データベース**: PostgreSQLの適切なバックアップ設定を行う

## ライセンス

MIT License
