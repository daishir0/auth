'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface SesSettings {
  enabled: boolean;
  region: string;
  accessKeyId: string;
  hasSecretAccessKey: boolean;
  fromAddress: string;
}

const SES_REGIONS = [
  { value: 'ap-northeast-1', label: 'アジアパシフィック (東京)' },
  { value: 'ap-northeast-2', label: 'アジアパシフィック (ソウル)' },
  { value: 'ap-northeast-3', label: 'アジアパシフィック (大阪)' },
  { value: 'ap-south-1', label: 'アジアパシフィック (ムンバイ)' },
  { value: 'ap-southeast-1', label: 'アジアパシフィック (シンガポール)' },
  { value: 'ap-southeast-2', label: 'アジアパシフィック (シドニー)' },
  { value: 'us-east-1', label: '米国東部 (バージニア北部)' },
  { value: 'us-west-2', label: '米国西部 (オレゴン)' },
  { value: 'eu-west-1', label: '欧州 (アイルランド)' },
];

export function SesForm() {
  const [settings, setSettings] = useState<SesSettings>({
    enabled: false,
    region: 'ap-northeast-1',
    accessKeyId: '',
    hasSecretAccessKey: false,
    fromAddress: '',
  });
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings/ses');
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
      const response = await fetch('/api/admin/settings/ses', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: settings.enabled,
          region: settings.region,
          accessKeyId: settings.accessKeyId,
          secretAccessKey: secretAccessKey || undefined,
          fromAddress: settings.fromAddress,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('設定を保存しました');
        setSecretAccessKey('');
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

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      toast.error('送信先メールアドレスを入力してください');
      return;
    }

    setSendingTest(true);

    try {
      const response = await fetch('/api/admin/settings/ses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setTestEmail('');
      } else {
        toast.error(data.error || 'テストメール送信に失敗しました');
      }
    } catch (error) {
      console.error('Failed to send test email:', error);
      toast.error('テストメール送信に失敗しました');
    } finally {
      setSendingTest(false);
    }
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
          <Label htmlFor="region">AWS リージョン</Label>
          <Select
            value={settings.region}
            onValueChange={(value) =>
              setSettings({ ...settings, region: value })
            }
          >
            <SelectTrigger id="region">
              <SelectValue placeholder="リージョンを選択" />
            </SelectTrigger>
            <SelectContent>
              {SES_REGIONS.map((region) => (
                <SelectItem key={region.value} value={region.value}>
                  {region.label} ({region.value})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="accessKeyId">Access Key ID</Label>
          <Input
            id="accessKeyId"
            type="text"
            placeholder="AKIAXXXXXXXXXXXXXXXX"
            value={settings.accessKeyId}
            onChange={(e) =>
              setSettings({ ...settings, accessKeyId: e.target.value })
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="secretAccessKey">
            Secret Access Key
            {settings.hasSecretAccessKey && (
              <span className="ml-2 text-xs text-green-600 font-normal">
                (設定済み)
              </span>
            )}
          </Label>
          <div className="relative">
            <Input
              id="secretAccessKey"
              type={showSecret ? 'text' : 'password'}
              placeholder={
                settings.hasSecretAccessKey
                  ? '変更する場合のみ入力'
                  : 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
              }
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
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
          <Label htmlFor="fromAddress">送信元メールアドレス</Label>
          <Input
            id="fromAddress"
            type="email"
            placeholder="noreply@example.com"
            value={settings.fromAddress}
            onChange={(e) =>
              setSettings({ ...settings, fromAddress: e.target.value })
            }
          />
          <p className="text-xs text-muted-foreground">
            SES で検証済みのメールアドレスまたはドメインを指定してください
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="enabled" className="cursor-pointer">
              メール送信を有効にする
            </Label>
            <p className="text-sm text-muted-foreground">
              有効にすると、メール確認などのメール送信機能が使用可能になります
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

      {settings.enabled && settings.hasSecretAccessKey && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">テストメール送信</h3>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label htmlFor="testEmail">送信先メールアドレス</Label>
              <Input
                id="testEmail"
                type="email"
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleSendTestEmail}
              disabled={sendingTest || !testEmail}
            >
              {sendingTest ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              テスト送信
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
