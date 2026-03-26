'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface Position {
  id: string;
  name: string;
  code: string;
  level: number;
  description?: string | null;
  isActive: boolean;
}

interface PositionFormProps {
  position?: Position;
  onSuccess?: () => void;
}

export function PositionForm({ position, onSuccess }: PositionFormProps) {
  const router = useRouter();
  const isEditing = !!position;

  const [name, setName] = useState(position?.name || '');
  const [code, setCode] = useState(position?.code || '');
  const [level, setLevel] = useState(position?.level ?? 0);
  const [description, setDescription] = useState(position?.description || '');
  const [isActive, setIsActive] = useState(position?.isActive ?? true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // バリデーション
    if (!name.trim()) {
      setError('役職名は必須です');
      return;
    }

    if (name.trim().length > 100) {
      setError('役職名は100文字以内で入力してください');
      return;
    }

    if (!code.trim()) {
      setError('役職コードは必須です');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(code.trim())) {
      setError('役職コードは英数字、ハイフン、アンダースコアのみ使用できます');
      return;
    }

    if (code.trim().length > 50) {
      setError('役職コードは50文字以内で入力してください');
      return;
    }

    if (level < 0 || level > 100) {
      setError('レベルは0〜100の範囲で入力してください');
      return;
    }

    if (description && description.length > 500) {
      setError('説明は500文字以内で入力してください');
      return;
    }

    setIsSubmitting(true);

    try {
      const endpoint = isEditing
        ? `/api/positions/${position.id}`
        : '/api/positions';

      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim(),
          level,
          description: description.trim() || null,
          ...(isEditing && { isActive }),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.error === 'Position code already exists') {
          throw new Error('この役職コードは既に使用されています');
        }
        throw new Error(data.error || 'エラーが発生しました');
      }

      const data = await response.json();

      toast.success(isEditing ? '役職を更新しました' : '役職を作成しました');

      if (onSuccess) {
        onSuccess();
      } else if (isEditing) {
        router.refresh();
      } else {
        router.push(`/positions/${data.position.id}`);
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
            役職の基本情報を入力してください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">役職名 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="部長"
              maxLength={100}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">役職コード *</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="manager"
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
            <Label htmlFor="level">レベル</Label>
            <Input
              id="level"
              type="number"
              value={level}
              onChange={(e) => setLevel(parseInt(e.target.value) || 0)}
              min={0}
              max={100}
            />
            <p className="text-xs text-muted-foreground">
              数値が高いほど上位役職（0〜100）
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">説明</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="役職の説明を入力..."
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
