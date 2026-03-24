'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  Trash2,
  KeyRound,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApplicationForm } from '@/components/applications/application-form';
import { ApplicationStats } from '@/components/applications/application-stats';
import { SecretDisplay } from '@/components/applications/secret-display';
import { toast } from 'sonner';

interface Application {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  redirectUris: string[];
  scopes: string[];
  grantTypes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  activeTokens: number;
}

interface ApplicationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ApplicationDetailPage({ params }: ApplicationDetailPageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    const fetchApplication = async () => {
      try {
        const response = await fetch(`/api/admin/applications/${resolvedParams.id}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('アプリケーションが見つかりません');
          }
          throw new Error('データの取得に失敗しました');
        }
        const data = await response.json();
        setApplication(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'エラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchApplication();
  }, [resolvedParams.id]);

  const handleRegenerateSecret = async () => {
    setIsRegenerating(true);
    try {
      const response = await fetch(`/api/admin/applications/${resolvedParams.id}/secret`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('シークレットの再生成に失敗しました');
      }

      const data = await response.json();
      setNewSecret(data.clientSecret);
      setRegenerateDialogOpen(false);
      setSecretDialogOpen(true);
      toast.success('シークレットを再生成しました');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleRevokeAllTokens = async () => {
    setIsRevoking(true);
    try {
      const response = await fetch(`/api/admin/applications/${resolvedParams.id}/tokens`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('トークンの無効化に失敗しました');
      }

      const data = await response.json();
      toast.success(data.message);
      setRevokeDialogOpen(false);

      // アプリケーション情報を再取得
      const appResponse = await fetch(`/api/admin/applications/${resolvedParams.id}`);
      if (appResponse.ok) {
        const appData = await appResponse.json();
        setApplication(appData);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsRevoking(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse h-8 bg-muted rounded w-48"></div>
        <div className="animate-pulse h-64 bg-muted rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/applications">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">エラー</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-destructive">{error}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!application) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/applications">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{application.name}</h1>
              <Badge variant={application.isActive ? 'default' : 'secondary'}>
                {application.isActive ? '有効' : '無効'}
              </Badge>
            </div>
            {application.description && (
              <p className="text-muted-foreground">{application.description}</p>
            )}
          </div>
        </div>
      </div>

      <ApplicationStats applicationId={application.id} />

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">基本情報</TabsTrigger>
          <TabsTrigger value="settings">設定変更</TabsTrigger>
          <TabsTrigger value="security">セキュリティ</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>クライアント情報</CardTitle>
              <CardDescription>
                OAuth認可に使用するクライアント情報
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Client ID</label>
                  <code className="block bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                    {application.clientId}
                  </code>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Client Secret</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
                      ••••••••••••••••
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRegenerateDialogOpen(true)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      再生成
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>リダイレクトURI</CardTitle>
              <CardDescription>
                OAuth認可後のリダイレクト先
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {application.redirectUris.map((uri, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <code className="bg-muted px-3 py-2 rounded text-sm font-mono flex-1 break-all">
                      {uri}
                    </code>
                    <Button variant="ghost" size="icon" asChild>
                      <a href={uri} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>スコープ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {application.scopes.map((scope) => (
                    <Badge key={scope} variant="outline">
                      {scope}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Grant Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {application.grantTypes.map((grantType) => (
                    <Badge key={grantType} variant="outline">
                      {grantType}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>日時情報</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">作成日時</label>
                  <p className="text-sm">
                    {new Date(application.createdAt).toLocaleString('ja-JP')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">最終更新日時</label>
                  <p className="text-sm">
                    {new Date(application.updatedAt).toLocaleString('ja-JP')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <div className="max-w-2xl">
            <ApplicationForm initialData={application} />
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>シークレット再生成</CardTitle>
              <CardDescription>
                クライアントシークレットを新しい値に更新します。
                古いシークレットは即座に無効化されます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => setRegenerateDialogOpen(true)}
              >
                <KeyRound className="h-4 w-4 mr-2" />
                シークレットを再生成
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>トークン無効化</CardTitle>
              <CardDescription>
                このアプリケーションに紐づく全てのリフレッシュトークンを無効化します。
                ユーザーは再度ログインが必要になります。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">
                    現在のアクティブトークン数:{' '}
                    <span className="font-medium">{application.activeTokens}</span>
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setRevokeDialogOpen(true)}
                  disabled={application.activeTokens === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  全トークンを無効化
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* シークレット再生成確認ダイアログ */}
      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>シークレットの再生成</DialogTitle>
            <DialogDescription>
              現在のクライアントシークレットは無効化され、新しいシークレットが発行されます。
              古いシークレットを使用しているアプリケーションは動作しなくなります。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRegenerateDialogOpen(false)}
              disabled={isRegenerating}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleRegenerateSecret}
              disabled={isRegenerating}
            >
              {isRegenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              再生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* トークン無効化確認ダイアログ */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>全トークンの無効化</DialogTitle>
            <DialogDescription>
              このアプリケーションを使用している全てのユーザーのトークンが無効化されます。
              ユーザーは再度認証が必要になります。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeDialogOpen(false)}
              disabled={isRevoking}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeAllTokens}
              disabled={isRevoking}
            >
              {isRevoking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              無効化
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新シークレット表示ダイアログ */}
      {newSecret && (
        <SecretDisplay
          open={secretDialogOpen}
          onOpenChange={setSecretDialogOpen}
          clientId={application.clientId}
          clientSecret={newSecret}
          applicationName={application.name}
        />
      )}
    </div>
  );
}
