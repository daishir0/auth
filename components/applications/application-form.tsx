'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const AVAILABLE_SCOPES = [
  { value: 'openid', label: 'OpenID', description: 'ユーザーの一意識別子' },
  { value: 'profile', label: 'Profile', description: '名前、プロフィール情報' },
  { value: 'email', label: 'Email', description: 'メールアドレス' },
  { value: 'offline_access', label: 'Offline Access', description: 'リフレッシュトークンの発行' },
  { value: 'custom', label: 'Custom', description: 'カスタムスコープ' },
];

const AVAILABLE_GRANT_TYPES = [
  { value: 'authorization_code', label: 'Authorization Code', description: 'Webアプリ向け' },
  { value: 'refresh_token', label: 'Refresh Token', description: 'トークンの更新' },
];

interface ApplicationFormProps {
  initialData?: {
    id: string;
    name: string;
    description: string | null;
    redirectUris: string[];
    scopes: string[];
    grantTypes: string[];
    isActive: boolean;
  };
  onSuccess?: (data: {
    id: string;
    clientId: string;
    clientSecret?: string;
    name: string;
  }) => void;
}

export function ApplicationForm({ initialData, onSuccess }: ApplicationFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [redirectUris, setRedirectUris] = useState<string[]>(
    initialData?.redirectUris || ['']
  );
  const [scopes, setScopes] = useState<string[]>(
    initialData?.scopes || ['openid', 'profile', 'email']
  );
  const [grantTypes, setGrantTypes] = useState<string[]>(
    initialData?.grantTypes || ['authorization_code', 'refresh_token']
  );
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddRedirectUri = () => {
    setRedirectUris([...redirectUris, '']);
  };

  const handleRemoveRedirectUri = (index: number) => {
    if (redirectUris.length > 1) {
      setRedirectUris(redirectUris.filter((_, i) => i !== index));
    }
  };

  const handleRedirectUriChange = (index: number, value: string) => {
    const newUris = [...redirectUris];
    newUris[index] = value;
    setRedirectUris(newUris);
  };

  const toggleScope = (scope: string) => {
    if (scopes.includes(scope)) {
      setScopes(scopes.filter((s) => s !== scope));
    } else {
      setScopes([...scopes, scope]);
    }
  };

  const toggleGrantType = (grantType: string) => {
    if (grantTypes.includes(grantType)) {
      setGrantTypes(grantTypes.filter((g) => g !== grantType));
    } else {
      setGrantTypes([...grantTypes, grantType]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // バリデーション
    if (!name.trim()) {
      setError('アプリケーション名は必須です');
      return;
    }

    const validUris = redirectUris.filter((uri) => uri.trim());
    if (validUris.length === 0) {
      setError('リダイレクトURIを少なくとも1つ指定してください');
      return;
    }

    if (scopes.length === 0) {
      setError('スコープを少なくとも1つ選択してください');
      return;
    }

    if (grantTypes.length === 0) {
      setError('Grant Typeを少なくとも1つ選択してください');
      return;
    }

    setIsSubmitting(true);

    try {
      const endpoint = isEditing
        ? `/api/admin/applications/${initialData.id}`
        : '/api/admin/applications';

      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          redirectUris: validUris,
          scopes,
          grantTypes,
          isActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'エラーが発生しました');
      }

      const data = await response.json();

      if (onSuccess) {
        onSuccess(data);
      } else if (isEditing) {
        router.push(`/applications/${initialData.id}`);
        router.refresh();
      } else {
        router.push('/applications');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
          <CardDescription>
            アプリケーションの基本情報を入力してください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">アプリケーション名 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Application"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">説明</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="アプリケーションの説明を入力..."
              rows={3}
            />
          </div>

          {isEditing && (
            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <Label>有効/無効</Label>
                <p className="text-sm text-muted-foreground">
                  無効化すると新規トークン発行ができなくなります
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>リダイレクトURI</CardTitle>
          <CardDescription>
            OAuth認可後のリダイレクト先URLを設定してください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {redirectUris.map((uri, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={uri}
                onChange={(e) => handleRedirectUriChange(index, e.target.value)}
                placeholder="https://example.com/callback"
                type="url"
              />
              {redirectUris.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveRedirectUri(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRedirectUri}
          >
            <Plus className="h-4 w-4 mr-2" />
            URIを追加
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>スコープ</CardTitle>
          <CardDescription>
            アプリケーションがアクセスできる情報を選択してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {AVAILABLE_SCOPES.map((scope) => (
              <div
                key={scope.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  scopes.includes(scope.value)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => toggleScope(scope.value)}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center mt-0.5 ${
                  scopes.includes(scope.value) ? 'bg-primary border-primary' : 'border-muted-foreground'
                }`}>
                  {scopes.includes(scope.value) && (
                    <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12">
                      <path fill="currentColor" d="M10.28 2.28L4 8.56l-2.28-2.28a.75.75 0 00-1.06 1.06l2.81 2.81a.75.75 0 001.06 0l6.78-6.78a.75.75 0 00-1.06-1.06z" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="font-medium text-sm">{scope.label}</div>
                  <div className="text-xs text-muted-foreground">{scope.description}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grant Types</CardTitle>
          <CardDescription>
            許可する認可フローを選択してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {AVAILABLE_GRANT_TYPES.map((grant) => (
              <div
                key={grant.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  grantTypes.includes(grant.value)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => toggleGrantType(grant.value)}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center mt-0.5 ${
                  grantTypes.includes(grant.value) ? 'bg-primary border-primary' : 'border-muted-foreground'
                }`}>
                  {grantTypes.includes(grant.value) && (
                    <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12">
                      <path fill="currentColor" d="M10.28 2.28L4 8.56l-2.28-2.28a.75.75 0 00-1.06 1.06l2.81 2.81a.75.75 0 001.06 0l6.78-6.78a.75.75 0 00-1.06-1.06z" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="font-medium text-sm">{grant.label}</div>
                  <div className="text-xs text-muted-foreground">{grant.description}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          キャンセル
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEditing ? '更新' : '作成'}
        </Button>
      </div>
    </form>
  );
}
