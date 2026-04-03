'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { AvatarUpload } from '@/components/profile/avatar-upload';
import { OrganizationMembershipEditor } from '@/components/users/organization-membership-editor';

const userSchema = z.object({
  displayName: z.string().max(100).optional().or(z.literal('')),
  firstName: z.string().max(50).optional().or(z.literal('')),
  lastName: z.string().max(50).optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  hireDate: z.string().optional().or(z.literal('')),
  isActive: z.boolean(),
});

type UserFormData = z.infer<typeof userSchema>;

interface Role {
  id: string;
  name: string;
  displayName: string;
}

interface Organization {
  id: string;
  name: string;
  code: string;
  isPrimary: boolean;
  membershipId?: string;
  position?: {
    id: string;
    name: string;
  } | null;
}

interface UserFormProps {
  user: {
    id: string;
    email: string;
    isActive: boolean;
    createdAt: string;
    lastLoginAt?: string | null;
    profile?: {
      displayName?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      avatarUrl?: string | null;
      phone?: string | null;
      hireDate?: string | null;
    } | null;
    roles: string[];
    organizations: Organization[];
  };
  allRoles: Role[];
  onUpdate: () => void;
}

export function UserForm({ user, allRoles, onUpdate }: UserFormProps) {
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.profile?.avatarUrl || null);
  const [userRoles, setUserRoles] = useState<string[]>(user.roles);
  const [togglingRole, setTogglingRole] = useState<string | null>(null);

  // hireDateをYYYY-MM-DD形式に変換
  const formatDateForInput = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    setValue,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      displayName: user.profile?.displayName || '',
      firstName: user.profile?.firstName || '',
      lastName: user.profile?.lastName || '',
      phone: user.profile?.phone || '',
      hireDate: formatDateForInput(user.profile?.hireDate),
      isActive: user.isActive,
    },
  });

  const isActive = watch('isActive');

  const onSubmit = async (data: UserFormData) => {
    setSaving(true);
    try {
      // プロフィール更新
      const profileResponse = await fetch(`/api/users/${user.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: data.displayName,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          hireDate: data.hireDate || null,
        }),
      });

      if (!profileResponse.ok) {
        throw new Error('プロフィールの更新に失敗しました');
      }

      // ステータス更新
      const statusResponse = await fetch(`/api/admin/users/${user.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: data.isActive }),
      });

      if (!statusResponse.ok) {
        throw new Error('ステータスの更新に失敗しました');
      }

      toast.success('ユーザー情報を更新しました');
      onUpdate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleToggle = async (roleName: string) => {
    setTogglingRole(roleName);
    try {
      const hasRole = userRoles.includes(roleName);
      const response = await fetch(`/api/admin/users/${user.id}/roles`, {
        method: hasRole ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleName }),
      });

      if (!response.ok) {
        throw new Error('ロールの更新に失敗しました');
      }

      setUserRoles(
        hasRole
          ? userRoles.filter((r) => r !== roleName)
          : [...userRoles, roleName]
      );
      toast.success(hasRole ? 'ロールを削除しました' : 'ロールを追加しました');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ロールの更新に失敗しました');
    } finally {
      setTogglingRole(null);
    }
  };

  const handleAvatarChange = (newAvatarUrl: string | null) => {
    setAvatarUrl(newAvatarUrl);
    onUpdate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>プロフィール画像</CardTitle>
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
          <CardDescription>ユーザーの基本情報を編集します</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input id="email" value={user.email} disabled className="bg-muted" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>登録日</Label>
                <div className="text-sm text-muted-foreground py-2">
                  {new Date(user.createdAt).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label>最終ログイン</Label>
                <div className="text-sm text-muted-foreground py-2">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'ログインなし'}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">表示名</Label>
              <Input id="displayName" {...register('displayName')} />
              {errors.displayName && (
                <p className="text-xs text-destructive">{errors.displayName.message}</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lastName">姓</Label>
                <Input id="lastName" {...register('lastName')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">名</Label>
                <Input id="firstName" {...register('firstName')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">電話番号</Label>
              <Input id="phone" {...register('phone')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hireDate">入社年月日</Label>
              <Input id="hireDate" type="date" {...register('hireDate')} />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>アカウント有効</Label>
                <p className="text-sm text-muted-foreground">
                  無効にするとログインできなくなります
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={(checked) => setValue('isActive', checked, { shouldDirty: true })}
              />
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
          <CardTitle>ロール</CardTitle>
          <CardDescription>ユーザーに付与されているロールを管理します</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {allRoles.map((role) => {
              const hasRole = userRoles.includes(role.name);
              const isToggling = togglingRole === role.name;

              return (
                <div
                  key={role.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <div className="font-medium">{role.displayName}</div>
                    <div className="text-sm text-muted-foreground">{role.name}</div>
                  </div>
                  <Switch
                    checked={hasRole}
                    disabled={isToggling}
                    onCheckedChange={() => handleRoleToggle(role.name)}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>所属組織</CardTitle>
          <CardDescription>ユーザーが所属している組織を管理します</CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationMembershipEditor
            userId={user.id}
            memberships={user.organizations.map((org) => ({
              membershipId: org.membershipId || org.id,
              organization: {
                id: org.id,
                name: org.name,
                code: org.code,
              },
              position: org.position || null,
              isPrimary: org.isPrimary,
            }))}
            onUpdate={onUpdate}
          />
        </CardContent>
      </Card>
    </div>
  );
}
