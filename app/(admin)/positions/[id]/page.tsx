'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Briefcase, Users, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PositionForm } from '@/components/positions/position-form';
import { toast } from 'sonner';

interface Position {
  id: string;
  name: string;
  code: string;
  level: number;
  description?: string | null;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function PositionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const fetchPosition = async () => {
    try {
      const response = await fetch(`/api/positions/${id}`);
      if (response.ok) {
        const data = await response.json();
        setPosition(data.position);
      } else if (response.status === 404) {
        toast.error('役職が見つかりません');
        router.push('/positions');
      }
    } catch (error) {
      console.error('Failed to fetch position:', error);
      toast.error('役職の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosition();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/positions/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('役職を削除しました');
        router.push('/positions');
      } else {
        const data = await response.json();
        if (data.error === 'Cannot delete position that is in use') {
          toast.error('使用中の役職は削除できません');
        } else {
          toast.error(data.error || '削除に失敗しました');
        }
      }
    } catch (error) {
      console.error('Failed to delete position:', error);
      toast.error('削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-10 bg-muted rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!position) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/positions">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            <h1 className="text-3xl font-bold tracking-tight">{position.name}</h1>
            <Badge variant={position.isActive ? 'default' : 'secondary'}>
              {position.isActive ? 'アクティブ' : '無効'}
            </Badge>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={position.memberCount > 0 || deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              削除
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>役職を削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                「{position.name}」を削除します。この操作は取り消せません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>削除</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>統計情報</CardTitle>
          <CardDescription>この役職の使用状況</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{position.memberCount}</span>
              <span className="text-muted-foreground">人が使用中</span>
            </div>
            {position.memberCount > 0 && (
              <p className="text-sm text-muted-foreground">
                ※ 使用中の役職は削除できません
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <PositionForm position={position} onSuccess={fetchPosition} />
    </div>
  );
}
