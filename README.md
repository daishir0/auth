# auth - ユーザー管理基盤

## 概要

Next.js 16で構築された統合ユーザー管理基盤です。認証・認可・ユーザー管理機能を提供し、複数のサービスで共通のユーザー基盤として機能します。

### 主な機能

- **認証機能**
  - ユーザー登録・ログイン・ログアウト
  - JWT (HS256) アクセストークン（有効期限15分）
  - Opaqueリフレッシュトークン（有効期限30日）
  - bcryptによるパスワードハッシュ化
  - アカウントロック機能（5回失敗で30分ロック）
  - MFA対応（TOTP）

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

- Next.js 16 / React 19
- PostgreSQL + Prisma ORM
- TypeScript
- Tailwind CSS

---

## インストール

### 前提条件

- Node.js 20+
- PostgreSQL 15+
- npm または pnpm

### セットアップ手順

```bash
# リポジトリをクローン
git clone <your-repo-url>
cd auth

# 依存パッケージをインストール
npm install

# 環境変数を設定
cp .env.local.example .env.local
# .env.local を編集

# PostgreSQL接続設定（.env.local）
DATABASE_URL="postgresql://user:password@localhost:5432/auth?schema=public"
JWT_SECRET="your-secret-key-64-chars-minimum..."

# データベースマイグレーション
npx prisma migrate deploy

# OAuthクライアントのシード
npx ts-node scripts/seed-oauth-client.ts

# 開発サーバー起動
npm run dev
```

サーバーは http://localhost:3019 で起動します。

---

## 他サービスからの利用方法

### OIDCプロバイダーとしての設定

このサービスはOIDC準拠のIdentity Providerとして機能します。他のサービス（例：policy-manager）から認証を委譲できます。

#### 1. クライアント登録

```bash
# シードスクリプトでクライアントを作成
# scripts/seed-oauth-client.ts を編集してクライアント情報を設定
npx ts-node scripts/seed-oauth-client.ts
```

または、管理画面から登録：`https://<your-auth-domain>/applications`

#### 2. NextAuth.js での設定例（クライアント側）

```typescript
// auth.config.ts
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
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.roles = profile.roles;
        token.permissions = profile.permissions;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.roles = token.roles;
      session.user.permissions = token.permissions;
      return session;
    }
  }
});
```

#### 3. 環境変数（クライアント側）

```env
AUTH_PROVIDER_ISSUER=https://<your-auth-domain>
AUTH_PROVIDER_ID=your-client-id
AUTH_PROVIDER_SECRET=your-client-secret
```

### 認証フロー

```
1. ユーザー → クライアントアプリ（ログインボタンクリック）
2. クライアントアプリ → auth サービス（/oauth/authorize）
3. auth サービス → ユーザー（ログイン画面表示）
4. ユーザー → auth サービス（認証情報入力）
5. auth サービス → クライアントアプリ（認可コード返却）
6. クライアントアプリ → auth サービス（/oauth/token）
7. auth サービス → クライアントアプリ（アクセストークン・IDトークン返却）
8. クライアントアプリ → auth サービス（/oauth/userinfo）
9. auth サービス → クライアントアプリ（ユーザー情報返却）
```

---

## API リファレンス

### 認証API

| メソッド | エンドポイント | 説明 |
|----------|----------------|------|
| POST | /api/auth/register | 新規ユーザー登録 |
| POST | /api/auth/login | ログイン |
| POST | /api/auth/logout | ログアウト |
| POST | /api/auth/refresh | トークン更新 |
| GET | /api/auth/verify | トークン検証 |
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
| GET | /api/users/:id/profile | プロフィール取得 |
| PATCH | /api/users/:id/profile | プロフィール更新 |
| GET | /api/users/:id/organizations | 所属組織一覧 |

### 組織管理API

| メソッド | エンドポイント | 説明 |
|----------|----------------|------|
| GET | /api/organizations | 組織一覧 |
| POST | /api/organizations | 組織作成 |
| GET | /api/organizations/:id | 組織詳細 |
| PATCH | /api/organizations/:id | 組織更新 |
| GET | /api/organizations/:id/members | メンバー一覧 |
| POST | /api/organizations/:id/members | メンバー追加 |
| DELETE | /api/organizations/:id/members/:userId | メンバー削除 |

### 役職管理API

| メソッド | エンドポイント | 説明 |
|----------|----------------|------|
| GET | /api/positions | 役職一覧 |
| POST | /api/positions | 役職作成 |
| PATCH | /api/positions/:id | 役職更新 |

---

## データモデル

### 主要テーブル

```
User（ユーザー）
├── UserCredential（認証情報）
│   └── hashedPassword, failedLoginAttempts, lockedUntil, mfaEnabled
├── UserProfile（プロフィール）
│   └── displayName, firstName, lastName, avatarUrl, hireDate, metadata
├── OrganizationMembership（組織所属・多対多）
│   └── userId, organizationId, positionId, isPrimary, startDate, endDate
└── UserGlobalRole（グローバルロール・多対多）
    └── userId, roleId, validFrom, validTo

Organization（組織）
└── id, name, code, description, parentId（階層）, isActive

Position（役職）
└── id, name, code, level, description, isActive

GlobalRole（グローバルロール）
├── id, name, displayName, description
└── GlobalRolePermission（権限との関連）

GlobalPermission（グローバル権限）
└── id, name, displayName, category

UserIdMapping（ID移行用マッピング）
└── newUserId, legacyId, sourceSystem
```

---

## 権限体系

### グローバルロール

| ロール | 説明 | 付与される権限 |
|--------|------|--------------|
| super_admin | システム管理者 | 全ての権限 |
| admin | サービス管理者 | ユーザー管理、設定管理 |
| user | 一般ユーザー | 基本機能 |

### グローバル権限

| 権限 | 説明 |
|------|------|
| user:read | ユーザー情報の閲覧 |
| user:write | ユーザー情報の編集 |
| user:admin | ユーザー管理 |
| org:read | 組織情報の閲覧 |
| org:write | 組織情報の編集 |
| org:admin | 組織管理 |
| role:admin | ロール・権限管理 |
| oauth:admin | OAuthクライアント管理 |

### サービス固有権限

各サービス（例：policy-manager）は独自の権限を定義できます。
authサービスのグローバル権限とは別に、サービスごとのきめ細かい権限管理が可能です。

---

## 移行ガイド

### 既存ユーザーの移行

```bash
# auth サービスで移行スクリプトを実行
cd auth
npx ts-node scripts/migrate-users.ts
```

移行スクリプトの動作：
1. 旧システムからユーザーを取得
2. authサービスにユーザーを作成（UUID生成）
3. UserIdMappingテーブルに旧ID→新IDのマッピングを保存
4. ロールマッピング（ADMIN → super_admin, STAFF → user）

### ロールマッピング

| 旧システム | auth |
|-----------|------|
| ADMIN | super_admin |
| STAFF | user |

---

## 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| DATABASE_URL | PostgreSQL接続文字列 | ✓ |
| JWT_SECRET | JWTの署名鍵（64文字以上推奨） | ✓ |
| NEXTAUTH_URL | サービスのベースURL | ✓ |
| NEXTAUTH_SECRET | NextAuthのシークレット | ✓ |

---

## 本番環境の注意点

1. **JWT_SECRET**: 必ず強力なランダム文字列を使用
2. **HTTPS**: 本番環境では必須
3. **データベース**: PostgreSQLの適切なバックアップ設定
4. **監査ログ**: 定期的なログの確認とアーカイブ

---

## ライセンス

MIT License

---

# auth - User Management Platform

## Overview

An integrated user management platform built with Next.js 16. Provides authentication, authorization, and user management features, serving as a common user infrastructure for multiple services.

### Key Features

- **Authentication**
  - User registration, login, logout
  - JWT (HS256) access tokens (15-minute expiration)
  - Opaque refresh tokens (30-day expiration)
  - Password hashing with bcrypt
  - Account lockout (30-minute lockout after 5 failures)
  - MFA support (TOTP)

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

- Next.js 16 / React 19
- PostgreSQL + Prisma ORM
- TypeScript
- Tailwind CSS

---

## License

MIT License
