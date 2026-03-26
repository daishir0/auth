'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserForm } from '@/components/users/user-form';

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

interface UserData {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: string;
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
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<UserData | null>(null);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('ユーザーが見つかりません');
        } else if (response.status === 403) {
          setError('このページにアクセスする権限がありません');
        } else {
          setError('ユーザー情報の取得に失敗しました');
        }
        return;
      }

      const data = await response.json();
      setUser(data.user);
      setAllRoles(data.allRoles);
    } catch (err) {
      setError('ユーザー情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/users">
            <ArrowLeft className="mr-2 h-4 w-4" />
            ユーザー一覧に戻る
          </Link>
        </Button>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName =
    user.profile?.displayName ||
    (user.profile?.firstName && user.profile?.lastName
      ? `${user.profile.lastName} ${user.profile.firstName}`
      : user.email);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <UserForm user={user} allRoles={allRoles} onUpdate={fetchUser} />
    </div>
  );
}
