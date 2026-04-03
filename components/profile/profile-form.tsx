'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Check, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AvatarUpload } from './avatar-upload';
import { useUser } from '@/components/providers/user-context';

const profileSchema = z.object({
  displayName: z.string().max(100, '表示名は100文字以内で入力してください').optional().or(z.literal('')),
  firstName: z.string().max(50, '名は50文字以内で入力してください').optional().or(z.literal('')),
  lastName: z.string().max(50, '姓は50文字以内で入力してください').optional().or(z.literal('')),
  phone: z.string().max(20, '電話番号は20文字以内で入力してください').optional().or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  user: {
    id: string;
    email: string;
    profile?: {
      displayName?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      avatarUrl?: string | null;
      phone?: string | null;
    } | null;
    authMethods?: {
      hasPassword: boolean;
      hasGoogle: boolean;
    };
  };
  onUpdate: () => void;
}

export function ProfileForm({ user, onUpdate }: ProfileFormProps) {
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.profile?.avatarUrl || null);
  const { refreshUser } = useUser();

  // パスワード設定用state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user.profile?.displayName || '',
      firstName: user.profile?.firstName || '',
      lastName: user.profile?.lastName || '',
      phone: user.profile?.phone || '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/users/${user.id}/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'プロフィールの更新に失敗しました');
      }

      toast.success('プロフィールを更新しました');
      onUpdate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'プロフィールの更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (newAvatarUrl: string | null) => {
    setAvatarUrl(newAvatarUrl);
    await refreshUser();
    onUpdate();
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーション
    if (newPassword.length < 8) {
      toast.error('新しいパスワードは8文字以上で入力してください');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('新しいパスワードが一致しません');
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch(`/api/users/${user.id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: user.authMethods?.hasPassword ? currentPassword : undefined,
          newPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'パスワードの設定に失敗しました');
      }

      const data = await response.json();
      toast.success(data.message);

      // フォームをリセット
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // ユーザー情報を更新
      await refreshUser();
      onUpdate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'パスワードの設定に失敗しました');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>プロフィール画像</CardTitle>
          <CardDescription>
            あなたのアバター画像を変更できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUpload
            userId={user.id}
            currentAvatarUrl={avatarUrl}
            displayName={user.profile?.displayName}
            email={user.email}
            onAvatarChange={handleAvatarChange}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
          <CardDescription>
            あなたのプロフィール情報を編集できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={user.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                メールアドレスは変更できません
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">表示名</Label>
              <Input
                id="displayName"
                {...register('displayName')}
                placeholder="例: 山田 太郎"
              />
              {errors.displayName && (
                <p className="text-xs text-destructive">{errors.displayName.message}</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lastName">姓</Label>
                <Input
                  id="lastName"
                  {...register('lastName')}
                  placeholder="例: 山田"
                />
                {errors.lastName && (
                  <p className="text-xs text-destructive">{errors.lastName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstName">名</Label>
                <Input
                  id="firstName"
                  {...register('firstName')}
                  placeholder="例: 太郎"
                />
                {errors.firstName && (
                  <p className="text-xs text-destructive">{errors.firstName.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">電話番号</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="例: 03-1234-5678"
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving || !isDirty}>
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
          <CardTitle>ログイン方法</CardTitle>
          <CardDescription>
            現在設定されているログイン方法を確認できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {user.authMethods?.hasPassword && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                メール・パスワード
                <Check className="h-3 w-3 text-green-500" />
              </Badge>
            )}
            {user.authMethods?.hasGoogle && (
              <Badge variant="outline" className="flex items-center gap-1">
                <svg className="h-3 w-3" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
                <Check className="h-3 w-3 text-green-500" />
              </Badge>
            )}
            {!user.authMethods?.hasPassword && !user.authMethods?.hasGoogle && (
              <span className="text-muted-foreground">未設定</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {user.authMethods?.hasPassword ? 'パスワード変更' : 'パスワード設定'}
          </CardTitle>
          <CardDescription>
            {user.authMethods?.hasPassword
              ? 'メール・パスワードでのログイン用パスワードを変更できます'
              : 'パスワードを設定すると、メール・パスワードでもログインできるようになります'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {user.authMethods?.hasPassword && (
              <div className="space-y-2">
                <Label htmlFor="currentPassword">現在のパスワード</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="newPassword">
                {user.authMethods?.hasPassword ? '新しいパスワード' : 'パスワード'}
              </Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">8文字以上</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">パスワード（確認）</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={savingPassword || !newPassword || !confirmPassword}
              >
                {savingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : user.authMethods?.hasPassword ? (
                  'パスワードを変更'
                ) : (
                  'パスワードを設定'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
