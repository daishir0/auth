# セキュリティガイド

## 概要

認証サービスのセキュリティ設計と、本番環境への移行時の注意事項について説明します。

---

## セキュリティ設計

### 認証方式

本サービスは以下の認証方式を採用しています：

| 要素 | 実装 |
|------|------|
| アクセストークン | JWT（HS256） |
| リフレッシュトークン | Opaque Token（ランダム文字列） |
| パスワードハッシュ | argon2id |
| トークン保存 | httpOnly Cookie |

---

## JWT 設定

### 現在の設定

| 設定項目 | 値 | 説明 |
|----------|-----|------|
| アルゴリズム | HS256 | HMAC SHA-256 |
| アクセストークン有効期限 | 15分 | 短めの設定で漏洩リスクを軽減 |
| リフレッシュトークン有効期限 | 30日 | 長期セッション維持 |

### シークレットキー管理

**重要**: JWT シークレットキーは本番環境で必ず変更してください。

```env
# 開発環境のデフォルト（絶対に本番で使用しない）
JWT_SECRET=fallback-secret-do-not-use-in-production

# 本番環境用（強力なランダム文字列を生成）
JWT_SECRET=<強力なランダム文字列>
```

**シークレットキーの生成方法**:

```bash
# Node.js で生成
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL で生成
openssl rand -hex 64
```

**推奨**:
- 最低 256 ビット（32 バイト）以上
- 本番と開発で異なるキーを使用
- シークレットキーは絶対にコードにハードコードしない
- 定期的にローテーション（3〜6ヶ月ごと）

---

## パスワードハッシュ（argon2id）

### 現在の設定

```typescript
{
  type: argon2.argon2id,  // argon2id バリアント（推奨）
  memoryCost: 65536,      // 64MB のメモリ使用
  timeCost: 3,            // 3 回の反復
  parallelism: 4,         // 4 スレッド並列
}
```

### 設定の意味

| パラメータ | 値 | 説明 |
|------------|-----|------|
| type | argon2id | argon2i と argon2d のハイブリッド。サイドチャネル攻撃と GPU 攻撃の両方に耐性 |
| memoryCost | 65536 | 64MB のメモリを使用。GPU ベースの攻撃を困難にする |
| timeCost | 3 | 計算時間を増加させ、ブルートフォース攻撃を遅延 |
| parallelism | 4 | 4 コアを使用して並列計算 |

### セキュリティレベル

この設定は OWASP の推奨設定を満たしています。本番環境でサーバーの性能に応じて調整可能です。

---

## Cookie 設定

### 現在の設定

```typescript
{
  httpOnly: true,                              // JavaScript からアクセス不可
  secure: process.env.NODE_ENV === 'production', // HTTPS のみ（本番環境）
  sameSite: 'lax',                             // CSRF 保護
  maxAge: 15 * 60,                             // 有効期限
  path: '/',                                   // 全パスで有効
}
```

### 各オプションの説明

| オプション | 値 | セキュリティ効果 |
|------------|-----|------------------|
| httpOnly | true | XSS 攻撃からトークンを保護 |
| secure | true（本番） | HTTPS 接続でのみ送信 |
| sameSite | lax | 基本的な CSRF 保護 |
| path | / | サービス全体で使用可能 |

---

## 本番環境移行時の注意点

### 必須チェックリスト

- [ ] **JWT シークレットの変更**: 強力なランダム文字列に変更
- [ ] **HTTPS の有効化**: SSL/TLS 証明書を設定
- [ ] **環境変数の確認**: `.env` ファイルがバージョン管理に含まれていないことを確認
- [ ] **データベースのバックアップ**: 定期的なバックアップを設定
- [ ] **ログの設定**: エラーログを適切に収集・監視

### 環境変数の設定

```env
# 本番環境の .env
NODE_ENV=production
JWT_SECRET=<強力なランダム文字列>
```

### HTTPS の強制

本番環境では必ず HTTPS を使用してください。Cookie の `secure` フラグは `NODE_ENV=production` で自動的に有効になります。

### リバースプロキシの設定例（nginx）

```nginx
server {
    listen 443 ssl;
    server_name auth.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3019;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## セキュリティ考慮事項

### 実装済みの保護

| 脅威 | 対策 |
|------|------|
| パスワード漏洩 | argon2id ハッシュ |
| XSS | httpOnly Cookie |
| CSRF | sameSite Cookie |
| トークン漏洩 | 短い有効期限（15分） |
| セッションハイジャック | トークンローテーション |
| ブルートフォース | (未実装) レート制限を追加推奨 |

### 今後の改善推奨事項

1. **レート制限の追加**
   - ログイン試行回数の制限
   - IP ベースのブロッキング

2. **2要素認証（2FA）の追加**
   - TOTP（Google Authenticator 等）
   - メールベースの確認

3. **監査ログの追加**
   - ログイン成功/失敗の記録
   - パスワード変更の記録

4. **パスワードポリシーの強化**
   - 複雑性要件（大文字、小文字、数字、記号）
   - 過去のパスワードの再利用防止

5. **アカウントロックアウト**
   - 連続失敗時の一時的ロック

---

## インシデント対応

### トークン漏洩が疑われる場合

1. **即座に JWT シークレットを変更**
   - すべての既存トークンが無効になります

2. **データベースのリフレッシュトークンを削除**
   ```bash
   npx prisma db execute --stdin <<< "DELETE FROM RefreshToken;"
   ```

3. **影響を受けたユーザーに通知**

### 不正アクセスの調査

```bash
# Prisma Studio でアクセスログを確認
npx prisma studio

# ユーザーのリフレッシュトークンを確認
# 不審な数のトークンがある場合は調査
```

---

## 関連ドキュメント

- [ユーザーガイド](./document.md) - システムの使い方
- [API リファレンス](./API.md) - API の詳細仕様
- [セットアップガイド](./SETUP.md) - 開発環境の構築手順
