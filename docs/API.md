# API リファレンス

## 概要

認証サービスの REST API 仕様書です。

**Base URL**: `http://localhost:3019`

---

## 認証フロー

```
1. [POST /api/auth/register] ← ユーザー登録
        ↓
2. [POST /api/auth/login] ← ログイン（トークン発行）
        ↓
3. [GET /api/auth/me] ← ユーザー情報取得（トークン認証）
        ↓
4. [POST /api/auth/refresh] ← トークン更新（必要に応じて）
        ↓
5. [POST /api/auth/logout] ← ログアウト
```

---

## トークンの使用方法

認証が必要なエンドポイントでは、以下のいずれかの方法でトークンを送信します：

### 1. Authorization ヘッダー

```
Authorization: Bearer <access_token>
```

### 2. Cookie（自動）

ログイン成功時に `access_token` と `refresh_token` が Cookie に自動保存されます。ブラウザからのリクエストでは自動的に送信されます。

---

## エンドポイント一覧

| メソッド | パス | 認証 | 説明 |
|----------|------|------|------|
| POST | /api/auth/register | 不要 | ユーザー登録 |
| POST | /api/auth/login | 不要 | ログイン |
| POST | /api/auth/logout | 不要 | ログアウト |
| POST | /api/auth/refresh | 不要 | トークン更新 |
| GET | /api/auth/verify | 必要 | トークン検証 |
| GET | /api/auth/me | 必要 | ユーザー情報取得 |

---

## エンドポイント詳細

### POST /api/auth/register

新規ユーザーを登録します。

#### リクエスト

```bash
curl -X POST http://localhost:3019/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

#### リクエストボディ

| フィールド | 型 | 必須 | 説明 |
|------------|------|------|------|
| email | string | はい | メールアドレス |
| password | string | はい | パスワード（8文字以上） |

#### 成功レスポンス（201 Created）

```json
{
  "message": "User registered successfully",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "roles": ["user"],
    "createdAt": "2025-03-06T10:00:00.000Z"
  }
}
```

#### エラーレスポンス

| ステータス | エラー | 説明 |
|------------|--------|------|
| 400 | Email and password are required | 必須項目が未入力 |
| 400 | Password must be at least 8 characters | パスワードが短い |
| 409 | Email already registered | メールアドレスが既に使用されている |
| 500 | Internal server error | サーバーエラー |

---

### POST /api/auth/login

ユーザーを認証し、トークンを発行します。

#### リクエスト

```bash
curl -X POST http://localhost:3019/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

#### リクエストボディ

| フィールド | 型 | 必須 | 説明 |
|------------|------|------|------|
| email | string | はい | メールアドレス |
| password | string | はい | パスワード |

#### 成功レスポンス（200 OK）

```json
{
  "message": "Login successful",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "test@example.com",
    "roles": ["user"]
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "a1b2c3d4e5f6..."
}
```

**Cookie 設定**: 成功時、以下の Cookie が自動設定されます。

| Cookie 名 | 有効期限 | オプション |
|-----------|----------|------------|
| access_token | 15分 | httpOnly, sameSite=lax |
| refresh_token | 30日 | httpOnly, sameSite=lax |

#### エラーレスポンス

| ステータス | エラー | 説明 |
|------------|--------|------|
| 400 | Email and password are required | 必須項目が未入力 |
| 401 | Invalid email or password | 認証失敗 |
| 500 | Internal server error | サーバーエラー |

---

### POST /api/auth/logout

ユーザーをログアウトし、トークンを無効化します。

#### リクエスト

**方法1: Cookie を使用（ブラウザ）**
```bash
curl -X POST http://localhost:3019/api/auth/logout \
  -b "refresh_token=a1b2c3d4e5f6..."
```

**方法2: ボディで指定**
```bash
curl -X POST http://localhost:3019/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "a1b2c3d4e5f6..."
  }'
```

#### リクエストボディ（オプション）

| フィールド | 型 | 必須 | 説明 |
|------------|------|------|------|
| refresh_token | string | いいえ | リフレッシュトークン（Cookie がある場合は不要） |

#### 成功レスポンス（200 OK）

```json
{
  "message": "Logout successful"
}
```

**Cookie 削除**: `access_token` と `refresh_token` の Cookie が削除されます。

#### エラーレスポンス

| ステータス | エラー | 説明 |
|------------|--------|------|
| 500 | Internal server error | サーバーエラー |

---

### POST /api/auth/refresh

リフレッシュトークンを使用して新しいトークンを発行します。

#### リクエスト

**方法1: Cookie を使用（ブラウザ）**
```bash
curl -X POST http://localhost:3019/api/auth/refresh \
  -b "refresh_token=a1b2c3d4e5f6..."
```

**方法2: ボディで指定**
```bash
curl -X POST http://localhost:3019/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "a1b2c3d4e5f6..."
  }'
```

#### リクエストボディ（オプション）

| フィールド | 型 | 必須 | 説明 |
|------------|------|------|------|
| refresh_token | string | いいえ | リフレッシュトークン（Cookie がある場合は不要） |

#### 成功レスポンス（200 OK）

```json
{
  "message": "Token refreshed successfully",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "new_a1b2c3d4e5f6..."
}
```

**注意**: リフレッシュ成功時、新しいリフレッシュトークンが発行され、古いトークンは無効化されます（トークンローテーション）。

#### エラーレスポンス

| ステータス | エラー | 説明 |
|------------|--------|------|
| 401 | No refresh token provided | トークンが未指定 |
| 401 | Invalid refresh token | トークンが無効 |
| 401 | Refresh token expired | トークンが期限切れ |
| 500 | Internal server error | サーバーエラー |

---

### GET /api/auth/verify

アクセストークンの有効性を検証します。

#### リクエスト

**方法1: Authorization ヘッダー**
```bash
curl -X GET http://localhost:3019/api/auth/verify \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**方法2: Cookie を使用**
```bash
curl -X GET http://localhost:3019/api/auth/verify \
  -b "access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### 成功レスポンス（200 OK）

```json
{
  "valid": true,
  "user": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "test@example.com",
    "roles": ["user"]
  }
}
```

#### エラーレスポンス

| ステータス | エラー | 説明 |
|------------|--------|------|
| 401 | No token provided | トークンが未指定 |
| 401 | Invalid or expired token | トークンが無効または期限切れ |
| 500 | Internal server error | サーバーエラー |

---

### GET /api/auth/me

認証済みユーザーの詳細情報を取得します。

#### リクエスト

**方法1: Authorization ヘッダー**
```bash
curl -X GET http://localhost:3019/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**方法2: Cookie を使用**
```bash
curl -X GET http://localhost:3019/api/auth/me \
  -b "access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### 成功レスポンス（200 OK）

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "test@example.com",
    "roles": ["user"],
    "createdAt": "2025-03-06T10:00:00.000Z",
    "updatedAt": "2025-03-06T10:00:00.000Z"
  }
}
```

#### エラーレスポンス

| ステータス | エラー | 説明 |
|------------|--------|------|
| 401 | No token provided | トークンが未指定 |
| 401 | Invalid or expired token | トークンが無効または期限切れ |
| 404 | User not found | ユーザーが存在しない |
| 500 | Internal server error | サーバーエラー |

---

## エラーコード一覧

### HTTP ステータスコード

| コード | 意味 | 説明 |
|--------|------|------|
| 200 | OK | リクエスト成功 |
| 201 | Created | リソース作成成功 |
| 400 | Bad Request | リクエストが不正 |
| 401 | Unauthorized | 認証が必要、または認証失敗 |
| 404 | Not Found | リソースが見つからない |
| 409 | Conflict | リソースが競合（重複など） |
| 500 | Internal Server Error | サーバー内部エラー |

### エラーレスポンス形式

すべてのエラーレスポンスは以下の形式で返されます：

```json
{
  "error": "エラーメッセージ"
}
```

---

## JWT トークン構造

### ペイロード

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "test@example.com",
  "roles": ["user"],
  "iat": 1709715600,
  "exp": 1709716500
}
```

| フィールド | 説明 |
|------------|------|
| userId | ユーザーID（UUID） |
| email | メールアドレス |
| roles | ロール配列 |
| iat | 発行時刻（Unix タイムスタンプ） |
| exp | 有効期限（Unix タイムスタンプ） |

### 署名アルゴリズム

- **アルゴリズム**: HS256（HMAC SHA-256）
- **シークレット**: 環境変数 `JWT_SECRET` で設定

---

## 関連ドキュメント

- [ユーザーガイド](./document.md) - システムの使い方
- [セットアップガイド](./SETUP.md) - 開発環境の構築手順
- [セキュリティガイド](./SECURITY.md) - セキュリティに関する注意事項
