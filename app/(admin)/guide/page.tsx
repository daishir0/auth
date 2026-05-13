'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Server,
  Key,
  Users,
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function GuidePage() {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('クリップボードにコピーしました');
  };

  const issuerUrl = typeof window !== 'undefined' ? window.location.origin : 'https://auth.senku.work';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">使い方</h1>
        <p className="text-muted-foreground">
          新しいアプリケーションをAuth Serviceに接続する方法を説明します
        </p>
      </div>

      {/* 概要セクション */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Auth Serviceとは
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Auth Serviceは、複数のアプリケーション間で共通のユーザー認証を提供する
            <strong>OAuth 2.0 / OpenID Connect 準拠</strong>の認証基盤です。
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">シングルサインオン</p>
                <p className="text-sm text-muted-foreground">一度ログインすれば全アプリで利用可能</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">ユーザー管理の一元化</p>
                <p className="text-sm text-muted-foreground">ユーザー登録・ロール管理を1箇所で</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">標準プロトコル</p>
                <p className="text-sm text-muted-foreground">OIDC対応のあらゆるライブラリで接続可能</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 新規アプリケーション連携手順 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            新規アプリケーション連携手順
          </CardTitle>
          <CardDescription>
            新しいアプリケーションをAuth Serviceに接続する4ステップ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">Step 1</Badge>
              <h3 className="font-semibold">アプリケーション登録</h3>
            </div>
            <div className="ml-8 space-y-2">
              <p className="text-sm text-muted-foreground">
                管理メニューの「アプリケーション」から新規アプリケーションを登録します。
              </p>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>アプリケーション名（例：My App）</li>
                <li>リダイレクトURI（例：https://myapp.example.com/api/auth/callback/auth-provider）</li>
              </ul>
              <Button variant="outline" size="sm" asChild>
                <a href="/applications/new">
                  アプリケーションを登録する
                  <ExternalLink className="ml-2 h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">Step 2</Badge>
              <h3 className="font-semibold">クライアントID・シークレットの取得</h3>
            </div>
            <div className="ml-8 space-y-2">
              <p className="text-sm text-muted-foreground">
                登録後、アプリケーション詳細画面で以下の情報を取得します：
              </p>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li><strong>Client ID</strong> - アプリケーションの識別子</li>
                <li><strong>Client Secret</strong> - 秘密鍵（安全に保管してください）</li>
              </ul>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">Step 3</Badge>
              <h3 className="font-semibold">アプリ側の環境変数設定</h3>
            </div>
            <div className="ml-8 space-y-2">
              <p className="text-sm text-muted-foreground">
                アプリケーションの <code className="bg-muted px-1 rounded">.env</code> ファイルに以下を追加：
              </p>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`# OAuth 2.0 / OIDC 認証設定
AUTH_PROVIDER_ID="your-client-id"
AUTH_PROVIDER_SECRET="your-client-secret"
AUTH_PROVIDER_ISSUER="${issuerUrl}"`}
                </pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(`# OAuth 2.0 / OIDC 認証設定
AUTH_PROVIDER_ID="your-client-id"
AUTH_PROVIDER_SECRET="your-client-secret"
AUTH_PROVIDER_ISSUER="${issuerUrl}"`)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">Step 4</Badge>
              <h3 className="font-semibold">NextAuth.js（Auth.js）の設定例</h3>
            </div>
            <div className="ml-8 space-y-2">
              <p className="text-sm text-muted-foreground">
                Next.jsアプリでNextAuth.jsを使用する場合の設定例：
              </p>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`// lib/auth/config.ts
const AuthProvider = {
  id: "auth-provider",
  name: "Auth Provider",
  type: "oidc" as const,
  issuer: process.env.AUTH_PROVIDER_ISSUER,
  clientId: process.env.AUTH_PROVIDER_ID,
  clientSecret: process.env.AUTH_PROVIDER_SECRET,
  authorization: {
    params: { scope: "openid profile email" }
  },
};

export const authOptions = {
  providers: [AuthProvider],
  // ...その他の設定
};`}
                </pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(`const AuthProvider = {
  id: "auth-provider",
  name: "Auth Provider",
  type: "oidc" as const,
  issuer: process.env.AUTH_PROVIDER_ISSUER,
  clientId: process.env.AUTH_PROVIDER_ID,
  clientSecret: process.env.AUTH_PROVIDER_SECRET,
  authorization: {
    params: { scope: "openid profile email" }
  },
};`)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ユーザー登録・ログインフロー */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            ユーザー登録・ログインフロー
          </CardTitle>
          <CardDescription>
            ユーザーがアプリケーションを利用するまでの流れ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 p-4 border rounded-lg">
              <Badge>1. ユーザー登録</Badge>
              <p className="text-sm text-muted-foreground">
                ユーザーはAuth Service（このサイト）で新規登録を行います。
                登録後、デフォルトで「user」ロールが付与されます。
              </p>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="h-6 w-6 text-muted-foreground hidden md:block" />
            </div>
            <div className="space-y-2 p-4 border rounded-lg">
              <Badge>2. アプリにアクセス</Badge>
              <p className="text-sm text-muted-foreground">
                ユーザーが連携アプリにアクセスすると、Auth Serviceにリダイレクトされます。
                既にログイン済みなら自動で認可されます。
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 p-4 border rounded-lg">
              <Badge>3. 自動同期</Badge>
              <p className="text-sm text-muted-foreground">
                初回ログイン時、アプリ側のDBにユーザー情報が自動的に同期されます。
                ロール情報も連携されます。
              </p>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="h-6 w-6 text-muted-foreground hidden md:block" />
            </div>
            <div className="space-y-2 p-4 border rounded-lg">
              <Badge variant="secondary">完了</Badge>
              <p className="text-sm text-muted-foreground">
                以降はシングルサインオンで、全ての連携アプリにログインなしでアクセスできます。
              </p>
            </div>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm">
              <strong>ポイント：</strong>ユーザー管理はAuth Serviceで一元管理されます。
              各アプリでユーザーを個別に作成する必要はありません。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* OIDCエンドポイント一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>OIDCエンドポイント一覧</CardTitle>
          <CardDescription>
            技術者向け：Auth ServiceのOpenID Connect エンドポイント
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">エンドポイント</th>
                  <th className="text-left py-2 pr-4">URL</th>
                  <th className="text-left py-2">説明</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2 pr-4 font-medium">Discovery</td>
                  <td className="py-2 pr-4">
                    <code className="bg-muted px-1 rounded text-xs">/.well-known/openid-configuration</code>
                  </td>
                  <td className="py-2 text-muted-foreground">OIDC設定の自動取得</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Authorization</td>
                  <td className="py-2 pr-4">
                    <code className="bg-muted px-1 rounded text-xs">/oauth/authorize</code>
                  </td>
                  <td className="py-2 text-muted-foreground">認可リクエスト</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Token</td>
                  <td className="py-2 pr-4">
                    <code className="bg-muted px-1 rounded text-xs">/oauth/token</code>
                  </td>
                  <td className="py-2 text-muted-foreground">トークン発行</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">UserInfo</td>
                  <td className="py-2 pr-4">
                    <code className="bg-muted px-1 rounded text-xs">/oauth/userinfo</code>
                  </td>
                  <td className="py-2 text-muted-foreground">ユーザー情報取得</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">JWKS</td>
                  <td className="py-2 pr-4">
                    <code className="bg-muted px-1 rounded text-xs">/.well-known/jwks.json</code>
                  </td>
                  <td className="py-2 text-muted-foreground">公開鍵（JWT検証用）</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
