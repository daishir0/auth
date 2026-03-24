'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApplicationTable } from '@/components/applications/application-table';
import { toast } from 'sonner';

interface Application {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  redirectUris: string[];
  scopes: string[];
  grantTypes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  activeTokens: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchApplications = useCallback(async (page: number, search: string, status: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (search) {
        params.set('search', search);
      }
      if (status && status !== 'all') {
        params.set('status', status);
      }

      const response = await fetch(`/api/admin/applications?${params}`);
      if (response.ok) {
        const data = await response.json();
        setApplications(data.applications);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error);
      toast.error('アプリケーション一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications(pagination.page, searchQuery, statusFilter);
  }, []);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    fetchApplications(1, query, statusFilter);
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    fetchApplications(1, searchQuery, status);
  };

  const handlePageChange = (page: number) => {
    fetchApplications(page, searchQuery, statusFilter);
  };

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        throw new Error('ステータスの更新に失敗しました');
      }

      toast.success(isActive ? '有効化しました' : '無効化しました');
      fetchApplications(pagination.page, searchQuery, statusFilter);
    } catch (error) {
      console.error('Failed to toggle status:', error);
      toast.error('ステータスの更新に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/applications/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('削除に失敗しました');
      }

      toast.success('アプリケーションを削除しました');
      fetchApplications(pagination.page, searchQuery, statusFilter);
    } catch (error) {
      console.error('Failed to delete application:', error);
      toast.error('削除に失敗しました');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">アプリケーション</h1>
          <p className="text-muted-foreground">
            OAuthクライアントアプリケーションを管理します
          </p>
        </div>
        <Button asChild>
          <Link href="/applications/new">
            <Plus className="h-4 w-4 mr-2" />
            新規作成
          </Link>
        </Button>
      </div>

      {loading && applications.length === 0 ? (
        <div className="space-y-4">
          <div className="animate-pulse h-10 bg-muted rounded w-96"></div>
          <div className="animate-pulse h-64 bg-muted rounded"></div>
        </div>
      ) : (
        <ApplicationTable
          applications={applications}
          pagination={pagination}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          onSearchChange={handleSearchChange}
          onStatusFilterChange={handleStatusFilterChange}
          onPageChange={handlePageChange}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
