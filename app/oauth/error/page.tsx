'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Suspense } from 'react';

function OAuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const appName = searchParams.get('app');

  const getErrorMessage = () => {
    switch (error) {
      case 'access_denied':
        return {
          title: 'アクセス権がありません',
          description: appName
            ? `「${appName}」へのアクセス権がありません。`
            : 'このアプリケーションへのアクセス権がありません。',
          guidance: 'このアプリケーションを利用するには、管理者に依頼してアクセス権を付与してもらってください。',
        };
      case 'invalid_client':
        return {
          title: 'クライアントエラー',
          description: 'アプリケーションの設定に問題があります。',
          guidance: '管理者にお問い合わせください。',
        };
      case 'invalid_request':
        return {
          title: 'リクエストエラー',
          description: '不正なリクエストです。',
          guidance: 'アプリケーションから再度ログインを試してください。',
        };
      case 'invalid_scope':
        return {
          title: 'スコープエラー',
          description: '要求されたスコープが許可されていません。',
          guidance: '管理者にお問い合わせください。',
        };
      default:
        return {
          title: 'エラーが発生しました',
          description: '認証処理中にエラーが発生しました。',
          guidance: 'しばらくしてから再度お試しください。',
        };
    }
  };

  const errorInfo = getErrorMessage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">{errorInfo.title}</CardTitle>
          <CardDescription className="text-base">
            {errorInfo.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground text-center">
            {errorInfo.guidance}
          </p>
          <Button asChild className="w-full">
            <Link href="/dashboard">
              <Home className="h-4 w-4 mr-2" />
              ダッシュボードに戻る
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OAuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48"></div>
        </div>
      </div>
    }>
      <OAuthErrorContent />
    </Suspense>
  );
}
