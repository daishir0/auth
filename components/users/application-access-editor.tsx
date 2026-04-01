'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ApplicationAccess {
  accessId: string;
  applicationId: string;
  clientId: string;
  name: string;
  description: string | null;
  appUrl: string | null;
  iconUrl: string | null;
  isActive: boolean;
  grantedAt: string;
  grantedBy: {
    id: string;
    email: string;
    displayName: string | null;
  } | null;
}

interface AvailableApplication {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
}

interface ApplicationAccessEditorProps {
  userId: string;
  onUpdate?: () => void;
}

export function ApplicationAccessEditor({ userId, onUpdate }: ApplicationAccessEditorProps) {
  const [applications, setApplications] = useState<ApplicationAccess[]>([]);
  const [availableApplications, setAvailableApplications] = useState<AvailableApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<string>('');
  const [deletingApp, setDeletingApp] = useState<ApplicationAccess | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchApplications = async () => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/applications`);
      if (!response.ok) {
        throw new Error('データの取得に失敗しました');
      }
      const data = await response.json();
      setApplications(data.applications);
      setAvailableApplications(data.availableApplications);
    } catch (error) {
      toast.error('アプリケーション情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [userId]);

  const handleAddApplication = async () => {
    if (!selectedApp) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: selectedApp }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'アクセス権の付与に失敗しました');
      }

      toast.success('アプリケーションへのアクセス権を付与しました');
      setAddDialogOpen(false);
      setSelectedApp('');
      await fetchApplications();
      onUpdate?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccess = async () => {
    if (!deletingApp) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/admin/users/${userId}/applications/${deletingApp.applicationId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'アクセス権の削除に失敗しました');
      }

      toast.success('アクセス権を削除しました');
      setDeleteDialogOpen(false);
      setDeletingApp(null);
      await fetchApplications();
      onUpdate?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>アプリケーションアクセス</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>アプリケーションアクセス</CardTitle>
          <CardDescription>
            このユーザーがログインできるアプリケーションを管理します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setAddDialogOpen(true)}
              disabled={availableApplications.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              アプリケーションを追加
            </Button>
          </div>

          {applications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              アクセス可能なアプリケーションがありません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>アプリケーション</TableHead>
                  <TableHead>付与日</TableHead>
                  <TableHead>付与者</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.accessId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {app.name}
                            {!app.isActive && (
                              <Badge variant="secondary">無効</Badge>
                            )}
                          </div>
                          {app.description && (
                            <div className="text-sm text-muted-foreground">
                              {app.description}
                            </div>
                          )}
                        </div>
                        {app.appUrl && (
                          <a
                            href={app.appUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(app.grantedAt)}</TableCell>
                    <TableCell>
                      {app.grantedBy
                        ? app.grantedBy.displayName || app.grantedBy.email
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingApp(app);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <p className="text-sm text-muted-foreground">
            ※ ここに表示されているアプリケーションのみログイン可能です
          </p>
        </CardContent>
      </Card>

      {/* アプリケーション追加ダイアログ */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>アプリケーションを追加</DialogTitle>
            <DialogDescription>
              このユーザーがアクセスできるアプリケーションを追加します
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Select value={selectedApp} onValueChange={setSelectedApp}>
              <SelectTrigger>
                <SelectValue placeholder="アプリケーションを選択" />
              </SelectTrigger>
              <SelectContent>
                {availableApplications.map((app) => (
                  <SelectItem key={app.id} value={app.id}>
                    {app.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={isSubmitting}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleAddApplication}
              disabled={!selectedApp || isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>アクセス権を削除</DialogTitle>
            <DialogDescription>
              「{deletingApp?.name}」へのアクセス権を削除します。
              このユーザーはこのアプリケーションにログインできなくなります。
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isSubmitting}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccess}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
