'use client';

import { useEffect, useState, useCallback } from 'react';
import { UserTable } from '@/components/users/user-table';

interface User {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  profile: {
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  } | null;
  roles: string[];
  primaryOrganization: {
    id: string;
    name: string;
    position?: string | null;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async (page: number, search: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (search) {
        params.set('search', search);
      }

      const response = await fetch(`/api/admin/users?${params}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(pagination.page, searchQuery);
  }, []);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    fetchUsers(1, query);
  };

  const handlePageChange = (page: number) => {
    fetchUsers(page, searchQuery);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ユーザー管理</h1>
        <p className="text-muted-foreground">
          システムに登録されているユーザーを管理します
        </p>
      </div>

      {loading && users.length === 0 ? (
        <div className="space-y-4">
          <div className="animate-pulse h-10 bg-muted rounded w-96"></div>
          <div className="animate-pulse h-64 bg-muted rounded"></div>
        </div>
      ) : (
        <UserTable
          users={users}
          pagination={pagination}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
