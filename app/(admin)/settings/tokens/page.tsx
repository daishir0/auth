'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface TokenSettings {
  accessTokenExpiresMinutes: number;
  refreshTokenExpiresDays: number;
}

interface Defaults {
  ACCESS_TOKEN_EXPIRES_MINUTES: number;
  REFRESH_TOKEN_EXPIRES_DAYS: number;
}

export default function TokenSettingsPage() {
  const [settings, setSettings] = useState<TokenSettings | null>(null);
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォーム値
  const [accessMinutes, setAccessMinutes] = useState('');
  const [refreshDays, setRefreshDays] = useState('');

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/admin/settings/tokens');
        if (!response.ok) {
          if (response.status === 403) {
            setError('この設定にアクセスする権限がありません');
          } else {
            setError('設定の取得に失敗しました');
          }
          return;
        }

        const data = await response.json();
        setSettings(data.settings);
        setDefaults(data.defaults);
        setAccessMinutes(data.settings.accessTokenExpiresMinutes.toString());
        setRefreshDays(data.settings.refreshTokenExpiresDays.toString());
      } catch {
        setError('設定の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/admin/settings/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessTokenExpiresMinutes: parseInt(accessMinutes, 10),
          refreshTokenExpiresDays: parseInt(refreshDays, 10),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '設定の更新に失敗しました');
      }

      const data = await response.json();
      setSettings(data.settings);
      toast.success('設定を保存しました');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '設定の更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (defaults) {
      setAccessMinutes(defaults.ACCESS_TOKEN_EXPIRES_MINUTES.toString());
      setRefreshDays(defaults.REFRESH_TOKEN_EXPIRES_DAYS.toString());
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">トークン設定</h1>
          </div>
        </div>
        <div className="animate-pulse">
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">トークン設定</h1>
          </div>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">トークン設定</h1>
          <p className="text-muted-foreground">
            認証トークンの有効期限を設定します
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>有効期限設定</CardTitle>
          <CardDescription>
            アクセストークンとリフレッシュトークンの有効期限を設定します。
            変更は次回ログイン時から適用されます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="accessMinutes">アクセストークン有効期限（分）</Label>
              <Input
                id="accessMinutes"
                type="number"
                min="1"
                max="60"
                value={accessMinutes}
                onChange={(e) => setAccessMinutes(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                1〜60分の範囲で設定してください（デフォルト: {defaults?.ACCESS_TOKEN_EXPIRES_MINUTES}分）
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refreshDays">リフレッシュトークン有効期限（日）</Label>
              <Input
                id="refreshDays"
                type="number"
                min="1"
                max="365"
                value={refreshDays}
                onChange={(e) => setRefreshDays(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                1〜365日の範囲で設定してください（デフォルト: {defaults?.REFRESH_TOKEN_EXPIRES_DAYS}日）
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={handleReset}>
                デフォルトに戻す
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  '保存'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>現在の設定</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">アクセストークン有効期限</dt>
              <dd className="font-medium">{settings?.accessTokenExpiresMinutes}分</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">リフレッシュトークン有効期限</dt>
              <dd className="font-medium">{settings?.refreshTokenExpiresDays}日</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
