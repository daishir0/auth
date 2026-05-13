# 認証サービス ユーザーガイド

## 概要

`auth.senku.work` で稼働する **OAuth 2.0 / OpenID Connect (OIDC)** 認証基盤の公式ドキュメントです。Next.js 15 で構築され、社内の複数アプリケーションに対する **シングルサインオン（SSO）** を提供します。

### 主な機能

- **OAuth 2.0 / OIDC 認証**: Authorization Code Flow + PKCE、Refresh Token、Discovery、JWKS、Revoke、Introspect
- **ユーザー管理**: 自己登録、メール検証、管理者によるユーザー管理、組織・役職管理
- **権限管理**: グローバルロール / ロール権限の RBAC、アプリ単位の利用許可（UserApplicationAccess）
- **多要素のログイン**: メール+パスワード（Argon2id）、Google SSO
- **管理画面**: ダッシュボード、アプリ管理、ユーザー管理、組織管理、SecurityLog 閲覧
- **本番運用機能**: Redis レート制限、SecurityLog による監査、CORS ホワイトリスト

---

## 役割と関係

| 役割 | 例 |
|------|-----|
| **OpenID Provider (OP)** | `auth.senku.work` （本サービス） |
| **Relying Party (RP)** | `policy-manager.senku.work`, `policy-manager-dev.senku.work` 等の利用側アプリ |
| **End User** | ブラウザのユーザー |

RP は OIDC Discovery 経由で OP の設定を自動取得し、Authorization Code Flow を行う。

---

## サービスURL

| 環境 | URL | ポート |
|------|-----|--------|
| 本番 | https://auth.senku.work | 3019 (Nginx upstream) |

---

## 画面（管理画面）

| 画面 | URL | 説明 |
|------|-----|------|
| ログイン | `/login` | メール/パスワード or Google でログイン |
| 新規登録 | `/register` | メール検証付きで自己登録 |
| ダッシュボード | `/dashboard` | 連携アプリの一覧 |
| プロフィール | `/profile` | 自分の情報を編集 |
| 使い方（管理者のみ） | `/guide` | OIDC 連携手順 |
| ユーザー管理（管理者のみ） | `/users` | ユーザー CRUD |
| 組織管理（管理者のみ） | `/organizations` | 組織 CRUD |
| 役職管理（管理者のみ） | `/positions` | 役職 CRUD |
| アプリケーション管理（管理者のみ） | `/applications` | OAuth クライアント CRUD |
| システム設定（管理者のみ） | `/settings` | Google SSO、SES、トークン設定 |

---

## OAuth クライアント連携（外部アプリ視点）

新規アプリを auth に接続する4ステップ:

1. **管理画面 → アプリケーション → 新規登録**
   - 名前、リダイレクト URI（例: `https://myapp.example.com/api/auth/callback/auth-provider`）
2. **Client ID / Client Secret 取得**
3. **アプリの `.env` に設定**
   ```env
   AUTH_PROVIDER_ID="<CLIENT_ID>"
   AUTH_PROVIDER_SECRET="<CLIENT_SECRET>"
   AUTH_PROVIDER_ISSUER="https://auth.senku.work"
   ```
4. **NextAuth.js (Auth.js) に OIDC プロバイダー登録**
   ```ts
   {
     id: "auth-provider", name: "Auth Provider", type: "oidc",
     issuer: process.env.AUTH_PROVIDER_ISSUER,
     clientId: process.env.AUTH_PROVIDER_ID,
     clientSecret: process.env.AUTH_PROVIDER_SECRET,
     authorization: { params: { scope: "openid profile email custom" } },
   }
   ```
5. **管理画面 → ユーザー管理 → 該当ユーザーにアプリ利用権限付与**（UserApplicationAccess）

---

## 関連ドキュメント

- [API.md](./API.md) - 全エンドポイント仕様
- [SECURITY.md](./SECURITY.md) - セキュリティ設計と運用ガイド
- [SETUP.md](./SETUP.md) - 開発・運用環境セットアップ

---

## 技術スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | Next.js 15.5 (App Router) |
| 言語 | TypeScript 5.x |
| データベース | PostgreSQL (Prisma 6) |
| キャッシュ/レート制限 | Redis (ioredis) |
| 認証ライブラリ | `jose` (RS256), `argon2` |
| UI | TailwindCSS + shadcn/ui |
| デプロイ | systemd (Ubuntu) + Nginx リバースプロキシ |
