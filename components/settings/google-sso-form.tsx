'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface GoogleSsoSettings {
  enabled: boolean;
  clientId: string;
  hasClientSecret: boolean;
}

interface GoogleSsoFormProps {
  redirectUri: string;
}

export function GoogleSsoForm({ redirectUri }: GoogleSsoFormProps) {
  const [settings, setSettings] = useState<GoogleSsoSettings>({
    enabled: false,
    clientId: '',
    hasClientSecret: false,
  });
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings/google-sso');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        toast.error('設定の取得に失敗しました');
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('設定の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/admin/settings/google-sso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: settings.enabled,
          clientId: settings.clientId,
          clientSecret: clientSecret || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('設定を保存しました');
        setClientSecret('');
        fetchSettings();
      } else {
        toast.error(data.error || '設定の保存に失敗しました');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyRedirectUri = async () => {
    await navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="clientId">Client ID</Label>
          <Input
            id="clientId"
            type="text"
            placeholder="xxxxxxxxx.apps.googleusercontent.com"
            value={settings.clientId}
            onChange={(e) =>
              setSettings({ ...settings, clientId: e.target.value })
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="clientSecret">
            Client Secret
            {settings.hasClientSecret && (
              <span className="ml-2 text-xs text-green-600 font-normal">
                (設定済み)
              </span>
            )}
          </Label>
          <div className="relative">
            <Input
              id="clientSecret"
              type={showSecret ? 'text' : 'password'}
              placeholder={
                settings.hasClientSecret
                  ? '変更する場合のみ入力'
                  : 'GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx'
              }
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSecret ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            既に設定済みの場合、変更しない限り新しい値を入力する必要はありません
          </p>
        </div>

        <div className="space-y-2">
          <Label>リダイレクト URI</Label>
          <p className="text-xs text-muted-foreground mb-1">
            Google Cloud Console の「承認済みのリダイレクト URI」に設定してください
          </p>
          <div className="flex items-center gap-2 bg-muted p-3 rounded-md">
            <code className="text-sm flex-1 break-all">{redirectUri}</code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyRedirectUri}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  コピー済み
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  コピー
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="enabled" className="cursor-pointer">
              Google SSO を有効にする
            </Label>
            <p className="text-sm text-muted-foreground">
              有効にすると、ログイン画面に「Googleでログイン」ボタンが表示されます
            </p>
          </div>
          <Switch
            id="enabled"
            checked={settings.enabled}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, enabled: checked })
            }
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          設定を保存
        </Button>
      </div>
    </form>
  );
}
