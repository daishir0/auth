'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Briefcase, Users, Plus, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { toast } from 'sonner';

interface Position {
  id: string;
  name: string;
  code: string;
  level: number;
  description?: string | null;
  isActive: boolean;
  memberCount: number;
}

export default function PositionsPage() {
  const router = useRouter();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPositions = async () => {
    try {
      const response = await fetch('/api/admin/positions');
      if (response.ok) {
        const data = await response.json();
        setPositions(data.positions);
      }
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, []);

  const handleDelete = async (position: Position) => {
    setDeletingId(position.id);
    try {
      const response = await fetch(`/api/positions/${position.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('役職を削除しました');
        fetchPositions();
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
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">役職管理</h1>
          <p className="text-muted-foreground">
            役職の一覧を確認・管理できます
          </p>
        </div>
        <Button asChild>
          <Link href="/positions/new">
            <Plus className="h-4 w-4 mr-2" />
            新規作成
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>役職一覧</CardTitle>
          <CardDescription>
            役職とその所属人数を表示しています（レベルが高いほど上位役職）
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded"></div>
              ))}
            </div>
          ) : positions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              役職が登録されていません
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>役職名</TableHead>
                    <TableHead>コード</TableHead>
                    <TableHead>レベル</TableHead>
                    <TableHead>説明</TableHead>
                    <TableHead>所属人数</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead className="w-[80px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position) => (
                    <TableRow
                      key={position.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/positions/${position.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{position.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {position.code}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{position.level}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {position.description || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {position.memberCount}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={position.isActive ? 'default' : 'secondary'}>
                          {position.isActive ? 'アクティブ' : '無効'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={position.memberCount > 0 || deletingId === position.id}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {deletingId === position.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>役職を削除しますか？</AlertDialogTitle>
                              <AlertDialogDescription>
                                「{position.name}」を削除します。この操作は取り消せません。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(position)}>
                                削除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
