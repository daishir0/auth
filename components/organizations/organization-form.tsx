'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface Organization {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface OrganizationFormProps {
  organization?: Organization;
  allOrganizations: Organization[];
  onSuccess?: () => void;
}

function getDescendantIds(orgId: string, organizations: Organization[]): string[] {
  const descendants: string[] = [];
  const children = organizations.filter(org => org.parentId === orgId);

  for (const child of children) {
    descendants.push(child.id);
    descendants.push(...getDescendantIds(child.id, organizations));
  }

  return descendants;
}

export function OrganizationForm({ organization, allOrganizations, onSuccess }: OrganizationFormProps) {
  const router = useRouter();
  const isEditing = !!organization;

  const [name, setName] = useState(organization?.name || '');
  const [code, setCode] = useState(organization?.code || '');
  const [description, setDescription] = useState(organization?.description || '');
  const [parentId, setParentId] = useState<string | null>(organization?.parentId || null);
  const [sortOrder, setSortOrder] = useState(organization?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(organization?.isActive ?? true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 親組織の選択肢から自身と子孫を除外
  const availableParents = allOrganizations.filter(org => {
    if (!isEditing) return org.isActive;
    if (org.id === organization.id) return false;
    const descendantIds = getDescendantIds(organization.id, allOrganizations);
    if (descendantIds.includes(org.id)) return false;
    return org.isActive;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // バリデーション
    if (!name.trim()) {
      setError('組織名は必須です');
      return;
    }

    if (name.trim().length > 100) {
      setError('組織名は100文字以内で入力してください');
      return;
    }

    if (!code.trim()) {
      setError('組織コードは必須です');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(code.trim())) {
      setError('組織コードは英数字、ハイフン、アンダースコアのみ使用できます');
      return;
    }

    if (code.trim().length > 50) {
      setError('組織コードは50文字以内で入力してください');
      return;
    }

    if (description && description.length > 500) {
      setError('説明は500文字以内で入力してください');
      return;
    }

    if (sortOrder < 0) {
      setError('表示順は0以上の値を入力してください');
      return;
    }

    setIsSubmitting(true);

    try {
      const endpoint = isEditing
        ? `/api/organizations/${organization.id}`
        : '/api/organizations';

      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim(),
          description: description.trim() || null,
          parentId: parentId || null,
          sortOrder,
          ...(isEditing && { isActive }),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.error === 'Organization code already exists') {
          throw new Error('この組織コードは既に使用されています');
        }
        if (data.error === 'Cannot set self as parent') {
          throw new Error('自分自身を親組織に設定することはできません');
        }
        throw new Error(data.error || 'エラーが発生しました');
      }

      const data = await response.json();

      toast.success(isEditing ? '組織を更新しました' : '組織を作成しました');

      if (onSuccess) {
        onSuccess();
      } else if (isEditing) {
        router.refresh();
      } else {
        router.push(`/organizations/${data.organization.id}`);
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
            組織の基本情報を入力してください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">組織名 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="営業部"
              maxLength={100}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">組織コード *</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="sales-dept"
              maxLength={50}
              required
              disabled={isEditing}
            />
            <p className="text-xs text-muted-foreground">
              英数字、ハイフン、アンダースコアのみ使用可能
              {isEditing && '（編集不可）'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">説明</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="組織の説明を入力..."
              rows={3}
              maxLength={500}
            />
          </div>

          {isEditing && (
            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <Label>有効/無効</Label>
                <p className="text-sm text-muted-foreground">
                  無効化すると新規メンバーを割り当てられなくなります
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
          <CardTitle>階層設定</CardTitle>
          <CardDescription>
            組織の階層構造と表示順を設定します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="parentId">親組織</Label>
            <Select
              value={parentId || 'none'}
              onValueChange={(value) => setParentId(value === 'none' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="親組織を選択（なしの場合はルート組織）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">なし（ルート組織）</SelectItem>
                {availableParents.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}（{org.code}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sortOrder">表示順</Label>
            <Input
              id="sortOrder"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              min={0}
            />
            <p className="text-xs text-muted-foreground">
              同階層内での表示順（小さい値が先に表示されます）
            </p>
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
