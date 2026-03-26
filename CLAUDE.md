# Auth Service

## サーバー情報

| 項目 | 値 |
|------|-----|
| ポート | **3019** |
| URL | https://auth.senku.work |
| Nginx upstream | `127.0.0.1:3019` |

## サーバー再起動手順

**改修後は必ずサービスを再起動すること。**

```bash
cd /home/ubuntu/daishiro/auth

# 1. ビルド（コード変更時）
npm run build

# 2. サービス再起動（systemctl使用）
sudo systemctl restart auth

# 3. 起動確認
sleep 3 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3019/login
```

### 手動起動（systemdが使えない場合）

```bash
# サーバー停止
fuser -k 3019/tcp || true
sleep 2

# サーバー起動
nohup npm run start > /tmp/auth-server.log 2>&1 &
```

**注意**: `npm run start -- -p XXXX` でポートを上書きしないこと。Nginxは3019に固定されている。

## 技術スタック

- Next.js 15
- Prisma (SQLite)
- Tailwind CSS + shadcn/ui
