# auth

## Overview

A JWT-based authentication microservice built with Next.js 14. Provides secure user authentication with access tokens, refresh tokens, and role-based access control.

### Features
- User registration and login
- JWT (HS256) access tokens with 15-minute expiration
- Opaque refresh tokens with 30-day expiration
- Password hashing with argon2id
- httpOnly cookie-based token storage
- Role-based authorization
- SQLite database with Prisma ORM

## Installation

1. Clone the repository
```bash
git clone https://github.com/daishir0/auth.git
cd auth
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
```bash
cp .env.local.example .env.local
# Edit .env.local and set your JWT_SECRET
```

4. Initialize the database
```bash
npx prisma migrate dev --name init
```

5. (Optional) Seed sample users
```bash
npm run seed
```

6. Start the development server
```bash
npm run dev
```

The server will start at http://localhost:3019

## Usage

### Web Interface

| Page | URL | Description |
|------|-----|-------------|
| Login | /login | User login form |
| Register | /register | New user registration |
| Dashboard | /dashboard | Authenticated user dashboard |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login and get tokens |
| POST | /api/auth/logout | Logout and invalidate tokens |
| POST | /api/auth/refresh | Refresh access token |
| GET | /api/auth/verify | Verify token validity |
| GET | /api/auth/me | Get current user info |

### CLI Test Tool

```bash
python3 cli/auth-cli.py
```

## Notes

- **JWT_SECRET**: Must be changed in production. Use a strong random string (64+ characters).
- **HTTPS**: In production, ensure HTTPS is enabled for secure cookie transmission.
- **Database**: SQLite is used by default. For production, consider PostgreSQL or MySQL.

## License

MIT License

---

# auth

## 概要

Next.js 14で構築されたJWTベースの認証マイクロサービスです。アクセストークン、リフレッシュトークン、ロールベースのアクセス制御による安全なユーザー認証を提供します。

### 機能
- ユーザー登録とログイン
- JWT (HS256) アクセストークン（有効期限15分）
- Opaqueリフレッシュトークン（有効期限30日）
- argon2idによるパスワードハッシュ
- httpOnly Cookieによるトークン保存
- ロールベースの認可
- Prisma ORMによるSQLiteデータベース

## インストール方法

1. リポジトリをクローン
```bash
git clone https://github.com/daishir0/auth.git
cd auth
```

2. 依存パッケージをインストール
```bash
npm install
```

3. 環境変数を設定
```bash
cp .env.local.example .env.local
# .env.localを編集してJWT_SECRETを設定
```

4. データベースを初期化
```bash
npx prisma migrate dev --name init
```

5. （オプション）サンプルユーザーを投入
```bash
npm run seed
```

6. 開発サーバーを起動
```bash
npm run dev
```

サーバーは http://localhost:3019 で起動します

## 使い方

### Web画面

| ページ | URL | 説明 |
|--------|-----|------|
| ログイン | /login | ユーザーログインフォーム |
| 登録 | /register | 新規ユーザー登録 |
| ダッシュボード | /dashboard | 認証済みユーザー用画面 |

### APIエンドポイント

| メソッド | エンドポイント | 説明 |
|----------|----------------|------|
| POST | /api/auth/register | 新規ユーザー登録 |
| POST | /api/auth/login | ログインしてトークン取得 |
| POST | /api/auth/logout | ログアウトしてトークン無効化 |
| POST | /api/auth/refresh | アクセストークン更新 |
| GET | /api/auth/verify | トークン有効性検証 |
| GET | /api/auth/me | 現在のユーザー情報取得 |

### CLIテストツール

```bash
python3 cli/auth-cli.py
```

## 注意点

- **JWT_SECRET**: 本番環境では必ず変更してください。強力なランダム文字列（64文字以上）を使用してください。
- **HTTPS**: 本番環境ではHTTPSを有効にして、Cookieの安全な送信を確保してください。
- **データベース**: デフォルトはSQLiteです。本番環境ではPostgreSQLやMySQLを検討してください。

## ライセンス

MIT License
