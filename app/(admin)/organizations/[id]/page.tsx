'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Users, FolderTree, Trash2, Loader2 } from 'lucide-react';
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
import { OrganizationForm } from '@/components/organizations/organization-form';
import { toast } from 'sonner';

interface Organization {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder: number;
  isActive: boolean;
  memberCount: number;
  parent?: { id: string; name: string; code: string } | null;
  children: { id: string; name: string; code: string }[];
  createdAt: string;
  updatedAt: string;
}

interface OrganizationListItem {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export default function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [allOrganizations, setAllOrganizations] = useState<OrganizationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    try {
      const [orgResponse, allOrgsResponse] = await Promise.all([
        fetch(`/api/organizations/${id}`),
        fetch('/api/organizations?flat=true'),
      ]);

      if (orgResponse.ok) {
        const data = await orgResponse.json();
        setOrganization(data.organization);
      } else if (orgResponse.status === 404) {
        toast.error('組織が見つかりません');
        router.push('/organizations');
        return;
      }

      if (allOrgsResponse.ok) {
        const data = await allOrgsResponse.json();
        setAllOrganizations(data.organizations);
      }
    } catch (error) {
      console.error('Failed to fetch organization:', error);
      toast.error('組織の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/organizations/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('組織を削除しました');
        router.push('/organizations');
      } else {
        const data = await response.json();
        if (data.error === 'Cannot delete organization with active children') {
          toast.error('子組織がある組織は削除できません');
        } else if (data.error === 'Cannot delete organization with active members') {
          toast.error('メンバーがいる組織は削除できません');
        } else {
          toast.error(data.error || '削除に失敗しました');
        }
      }
    } catch (error) {
      console.error('Failed to delete organization:', error);
      toast.error('削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = organization && organization.memberCount === 0 && organization.children.length === 0;

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

  if (!organization) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/organizations">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            <h1 className="text-3xl font-bold tracking-tight">{organization.name}</h1>
            <Badge variant={organization.isActive ? 'default' : 'secondary'}>
              {organization.isActive ? 'アクティブ' : '無効'}
            </Badge>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={!canDelete || deleting}
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
              <AlertDialogTitle>組織を削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                「{organization.name}」を削除します。この操作は取り消せません。
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
          <CardDescription>この組織の使用状況</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{organization.memberCount}</span>
              <span className="text-muted-foreground">人のメンバー</span>
            </div>
            <div className="flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{organization.children.length}</span>
              <span className="text-muted-foreground">子組織</span>
            </div>
            {!canDelete && (
              <p className="text-sm text-muted-foreground w-full mt-2">
                ※ メンバーや子組織がある組織は削除できません
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {organization.parent && (
        <Card>
          <CardHeader>
            <CardTitle>親組織</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/organizations/${organization.parent.id}`}
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <Building2 className="h-4 w-4" />
              {organization.parent.name}（{organization.parent.code}）
            </Link>
          </CardContent>
        </Card>
      )}

      {organization.children.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>子組織一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {organization.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/organizations/${child.id}`}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-muted text-primary"
                >
                  <Building2 className="h-4 w-4" />
                  {child.name}（{child.code}）
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <OrganizationForm
        organization={organization}
        allOrganizations={allOrganizations}
        onSuccess={fetchData}
      />
    </div>
  );
}
