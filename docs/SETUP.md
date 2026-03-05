# セットアップガイド

## 概要

認証サービスの開発環境構築手順を説明します。

---

## 前提条件

以下のソフトウェアがインストールされている必要があります：

| ソフトウェア | バージョン | 確認コマンド |
|--------------|------------|--------------|
| Node.js | 18.x 以上 | `node -v` |
| npm | 9.x 以上 | `npm -v` |

---

## インストール手順

### 1. リポジトリのクローン（必要な場合）

```bash
cd ~/daishiro
```

### 2. 依存パッケージのインストール

```bash
cd auth
npm install
```

### 3. 環境変数の設定

`.env.local` ファイルを作成または編集します：

```bash
# 既存のファイルを確認
cat .env.local
```

必要な環境変数：

```env
# JWT シークレットキー（本番環境では必ず変更）
JWT_SECRET=your-super-secret-key-change-this-in-production
```

**重要**: `JWT_SECRET` は本番環境では必ず強力なランダム文字列に変更してください。

### 4. データベースの初期化

Prisma を使用してデータベースを設定します：

```bash
# マイグレーションを実行
npx prisma migrate dev --name init

# （オプション）Prisma Studio でデータベースを確認
npx prisma studio
```

データベースファイルは `db/auth.db`（SQLite）に作成されます。

### 5. サンプルユーザーの投入

初期データを投入します：

```bash
npm run seed
```

以下のテストユーザーが作成されます：

| Email | パスワード | Roles |
|-------|-----------|-------|
| test@example.com | password123 | user |
| admin@example.com | adminpass123 | user, admin |

---

## 開発サーバーの起動

```bash
npm run dev
```

サーバーが起動したら、以下の URL にアクセスできます：

- **アプリケーション**: http://localhost:3019
- **ログイン画面**: http://localhost:3019/login
- **登録画面**: http://localhost:3019/register

---

## 利用可能なスクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | 本番用にビルド |
| `npm run start` | 本番サーバーを起動 |
| `npm run lint` | ESLint でコードをチェック |
| `npm run seed` | テストユーザーを投入 |

---

## ディレクトリ構成

```
auth/
├── app/                    # Next.js App Router
│   ├── api/auth/          # API エンドポイント
│   │   ├── login/         # ログイン API
│   │   ├── logout/        # ログアウト API
│   │   ├── me/            # ユーザー情報 API
│   │   ├── refresh/       # トークン更新 API
│   │   ├── register/      # 登録 API
│   │   └── verify/        # 検証 API
│   ├── dashboard/         # ダッシュボード画面
│   ├── login/             # ログイン画面
│   ├── register/          # 登録画面
│   ├── globals.css        # グローバルスタイル
│   ├── layout.tsx         # ルートレイアウト
│   └── page.tsx           # トップページ
├── components/            # React コンポーネント
├── lib/                   # ユーティリティ
│   ├── auth.ts           # JWT 関連
│   ├── db.ts             # Prisma クライアント
│   └── password.ts       # パスワードハッシュ
├── prisma/
│   └── schema.prisma     # データベーススキーマ
├── db/                   # SQLite データベースファイル
├── docs/                 # ドキュメント
├── scripts/              # スクリプト
│   └── seed.ts           # シードスクリプト
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

---

## データベース管理

### Prisma Studio

GUI でデータベースを管理できます：

```bash
npx prisma studio
```

ブラウザで http://localhost:5555 が開きます。

### マイグレーション

スキーマを変更した場合：

```bash
# 新しいマイグレーションを作成
npx prisma migrate dev --name <migration_name>

# マイグレーションを適用（本番）
npx prisma migrate deploy
```

### データベースのリセット

開発中にデータベースを完全にリセットする場合：

```bash
# データベースを削除して再作成
rm -rf db/auth.db
npx prisma migrate dev --name init
npm run seed
```

---

## トラブルシューティング

### `npm install` でエラーが発生する

**argon2 のビルドエラー**:

argon2 はネイティブモジュールのため、ビルドツールが必要です。

```bash
# Ubuntu/Debian
sudo apt-get install build-essential python3

# macOS
xcode-select --install
```

### Prisma のエラー

```bash
# Prisma クライアントを再生成
npx prisma generate

# データベース接続を確認
npx prisma db push
```

### ポート 3019 が使用中

```bash
# 使用中のプロセスを確認
lsof -i :3019

# 別のポートで起動
npm run dev -- -p 3020
```

---

## 次のステップ

- [ユーザーガイド](./document.md) - システムの使い方を確認
- [API リファレンス](./API.md) - API の詳細仕様
- [セキュリティガイド](./SECURITY.md) - 本番運用時の注意点
