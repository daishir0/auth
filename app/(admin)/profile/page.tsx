'use client';

import { useEffect, useState, useCallback } from 'react';
import { ProfileForm } from '@/components/profile/profile-form';

interface UserData {
  id: string;
  email: string;
  profile?: {
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
    phone?: string | null;
  } | null;
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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

  if (!user) {
    return (
      <div className="text-center text-muted-foreground">
        ユーザー情報を取得できませんでした
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">プロフィール</h1>
        <p className="text-muted-foreground">
          あなたのプロフィール情報を管理します
        </p>
      </div>

      <ProfileForm user={user} onUpdate={fetchUser} />
    </div>
  );
}
