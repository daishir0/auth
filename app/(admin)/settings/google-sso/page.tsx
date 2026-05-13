'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GoogleSsoGuide } from '@/components/settings/google-sso-guide';
import { GoogleSsoForm } from '@/components/settings/google-sso-form';

export default function GoogleSsoSettingsPage() {
  // ベースURLを取得（クライアントサイドで）
  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : 'https://auth.senku.work';
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Google SSO 設定</h1>
          <p className="text-muted-foreground">
            Google アカウントでのログインを設定します
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <GoogleSsoGuide redirectUri={redirectUri} />

        <Card>
          <CardHeader>
            <CardTitle>設定</CardTitle>
            <CardDescription>
              Google Cloud Console で作成した OAuth クライアントの情報を入力してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GoogleSsoForm redirectUri={redirectUri} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
