'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
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

interface UserAccess {
  accessId: string;
  userId: string;
  email: string;
  isActive: boolean;
  displayName: string | null;
  roles: string[];
  grantedAt: string;
  grantedBy: {
    id: string;
    email: string;
    displayName: string | null;
  } | null;
}

interface AvailableUser {
  id: string;
  email: string;
  displayName: string | null;
}

interface AccessManagementProps {
  applicationId: string;
}

export function AccessManagement({ applicationId }: AccessManagementProps) {
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [deletingUser, setDeletingUser] = useState<UserAccess | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`/api/admin/applications/${applicationId}/access`);
      if (!response.ok) {
        throw new Error('データの取得に失敗しました');
      }
      const data = await response.json();
      setUsers(data.users);
      setAvailableUsers(data.availableUsers);
    } catch (error) {
      toast.error('アクセス情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [applicationId]);

  const handleAddUser = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/applications/${applicationId}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'アクセス権の付与に失敗しました');
      }

      toast.success('ユーザーにアクセス権を付与しました');
      setAddDialogOpen(false);
      setSelectedUser('');
      await fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccess = async () => {
    if (!deletingUser) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/admin/applications/${applicationId}/access/${deletingUser.userId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'アクセス権の削除に失敗しました');
      }

      toast.success('アクセス権を削除しました');
      setDeleteDialogOpen(false);
      setDeletingUser(null);
      await fetchUsers();
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

  const getRoleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' => {
    if (role === 'super_admin') return 'destructive';
    if (role === 'admin') return 'default';
    return 'secondary';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>アクセス管理</CardTitle>
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
          <CardTitle>アクセス管理</CardTitle>
          <CardDescription>
            このアプリケーションにアクセスできるユーザー: {users.length}人
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setAddDialogOpen(true)}
              disabled={availableUsers.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              ユーザーを追加
            </Button>
          </div>

          {users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              アクセス可能なユーザーがいません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ユーザー</TableHead>
                  <TableHead>メールアドレス</TableHead>
                  <TableHead>ロール</TableHead>
                  <TableHead>付与日</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.accessId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {user.displayName || '-'}
                        </span>
                        {!user.isActive && (
                          <Badge variant="outline">無効</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <Badge key={role} variant={getRoleBadgeVariant(role)}>
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(user.grantedAt)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingUser(user);
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
        </CardContent>
      </Card>

      {/* ユーザー追加ダイアログ */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ユーザーを追加</DialogTitle>
            <DialogDescription>
              このアプリケーションにアクセスできるユーザーを追加します
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="ユーザーを選択" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.displayName
                      ? `${user.displayName} (${user.email})`
                      : user.email}
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
              onClick={handleAddUser}
              disabled={!selectedUser || isSubmitting}
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
              「{deletingUser?.displayName || deletingUser?.email}」のアクセス権を削除します。
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
