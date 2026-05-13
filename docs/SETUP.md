# セットアップガイド

## 概要

`auth.senku.work` のセットアップ手順。開発環境（cc相当）と本番環境（prod）の両方をカバー。

---

## 前提条件

| ソフトウェア | 推奨 | 確認 |
|--------------|------|------|
| Node.js | 20.x 以上 | `node -v` |
| npm | 10.x 以上 | `npm -v` |
| PostgreSQL | 16 以上 | `psql --version` |
| Redis | 7 以上 | `redis-cli --version` |
| Nginx | 1.24 以上 | `nginx -v` |
| systemd | 250 以上 | `systemctl --version` |

---

## 1. 依存パッケージのインストール

```bash
npm --prefix /home/ubuntu/daishiro/auth install
```

主要依存:
- `next@15.5`, `react@19`, `@prisma/client@6`
- `jose@6`（RS256 JWT）、`argon2@0.40`
- `ioredis@5`（レート制限）

---

## 2. PostgreSQL セットアップ

### DB ・ユーザー作成

```bash
sudo -u postgres psql <<'SQL'
CREATE USER auth_user WITH PASSWORD '<secure-password>';
CREATE DATABASE auth OWNER auth_user;
GRANT ALL PRIVILEGES ON DATABASE auth TO auth_user;
SQL
```

### マイグレーション

```bash
npm --prefix /home/ubuntu/daishiro/auth exec prisma migrate deploy
npm --prefix /home/ubuntu/daishiro/auth exec prisma generate
```

### 初期データ（管理者ユーザー、ロール、OAuth クライアント）

```bash
# 1. シードでロール・管理者を投入（プロジェクトに seed があれば）
npm --prefix /home/ubuntu/daishiro/auth exec prisma db seed

# 2. OAuth クライアント登録
bash -c "set -a; source /home/ubuntu/daishiro/auth/.env.local; set +a; \
  node /home/ubuntu/daishiro/auth/scripts/rotate-secrets.mjs"
# 出力された AUTH_PROVIDER_SECRET_PROD / _DEV を policy-manager 等の .env に転記

# 3. ユーザーへアプリ利用権を付与（UserApplicationAccess）
sudo -u postgres psql -d auth <<'SQL'
INSERT INTO "UserApplicationAccess" (id, "userId", "applicationId", "grantedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid(), u.id, oc.id, NOW(), NOW(), NOW()
FROM "User" u CROSS JOIN "OAuthClient" oc
WHERE u.email IN ('admin@senku.work', 'user@senku.work')
  AND oc."clientId" IN ('policy-manager-prod', 'policy-manager-dev')
ON CONFLICT ("userId", "applicationId") DO NOTHING;
SQL
```

---

## 3. Redis セットアップ

```bash
sudo apt install -y redis-server

# requirepass 設定（本番必須）
PASS=$(openssl rand -hex 32)
sudo sed -i "s|^# requirepass foobared|requirepass ${PASS}|" /etc/redis/redis.conf
# bind 127.0.0.1 が有効になっていることを確認
sudo systemctl restart redis-server

# auth/.env.local に追加
echo "REDIS_URL=\"redis://:${PASS}@127.0.0.1:6379\"" >> /home/ubuntu/daishiro/auth/.env.local
```

---

## 4. 環境変数 (`.env.local`)

`.gitignore` 必須。

```env
# Database
DATABASE_URL="postgresql://auth_user:<password>@localhost:5432/auth?schema=public"

# OAuth / OIDC
OAUTH_ISSUER="https://auth.senku.work"
OAUTH_KEY_ID="auth-key-001"

# Application
NODE_ENV="production"
PORT="3019"

# Legacy API（OAuth移行完了後は false）
LEGACY_API_ENABLED=false

# CORS（ホワイトリスト方式、* 禁止）
CORS_ALLOWED_ORIGINS="https://policy-manager.senku.work,https://policy-manager-dev.senku.work"

# Secrets（高エントロピー値）
JWT_SECRET="<openssl rand -base64 64>"
ENCRYPTION_SECRET="<openssl rand -hex 32>"

# Redis
REDIS_URL="redis://:<password>@127.0.0.1:6379"
```

> `keys/private.pem` は初回起動時に `generateAndSaveKeyPairSync()` が自動生成。`.gitignore` 必須。

---

## 5. ビルド

```bash
npm --prefix /home/ubuntu/daishiro/auth run build
```

ビルド成果物は `.next/`。

---

## 6. systemd サービス

### `/etc/systemd/system/auth.service`

```ini
[Unit]
Description=Auth Service (Next.js)
After=network.target redis-server.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/daishiro/auth
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/auth.log
StandardError=append:/var/log/auth.log
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now auth
sudo systemctl status auth
```

---

## 7. Nginx リバプロ設定

`/etc/nginx/sites-available/auth`:

```nginx
upstream auth_backend { server 127.0.0.1:3019; }

server {
    listen 80;
    server_name auth.senku.work;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name auth.senku.work;

    ssl_certificate     /etc/ssl/certs/senku.work-fullchain.pem;
    ssl_certificate_key /etc/ssl/private/senku.work-privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://auth_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/auth /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 8. 動作確認

```bash
# サービス active
sudo systemctl is-active auth redis-server

# OIDC Discovery
curl -s https://auth.senku.work/.well-known/openid-configuration | jq '.issuer,.response_types_supported'

# 旧API は 410
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://auth.senku.work/api/auth/login -d '{}' \
  -H 'Content-Type: application/json'   # 期待: 410

# 管理画面 ログイン
curl -s -X POST https://auth.senku.work/api/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@senku.work","password":"<password>"}' | jq
```

---

## 9. 開発・デプロイ運用

`/home/ubuntu/daishiro/CLAUDE.md` の **パターン2**（prod のみに存在するサービス）に従う:

1. prod 上で開発
2. push 時は cc 側に rsync で一時コピー
3. cc から `git push`
4. prod で `git fetch && git reset --hard origin/main`
5. `npm run build && sudo systemctl restart auth`
6. cc 側の一時ディレクトリ削除

prod に GitHub 認証情報は **置かない**。

---

## 10. トラブルシューティング

| 症状 | 対処 |
|------|------|
| `Could not find a production build` | `npm run build` 実行 |
| `redirect_uri_mismatch` (Google SSO) | Google Cloud Console の承認済み URI と `/api/auth/google/callback` 一致確認 |
| OAuth クライアントで `access_denied` | `UserApplicationAccess` の grant 漏れを確認 |
| ダッシュボードで「URLが設定されていません」 | `OAuthClient.appUrl` が NULL → SQL UPDATE |
| `rate_limit_exceeded`（429）が頻発 | Redis 疎通確認、IP制限値の見直し |
| `Stream isn't writeable` ログ | ioredis 接続初期化エラー、`enableOfflineQueue: true` 確認 |
