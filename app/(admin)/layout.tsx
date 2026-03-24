'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { UserProvider } from '@/components/providers/user-context';
import { Toaster } from 'sonner';

interface UserData {
  id: string;
  email: string;
  roles: string[];
  profile?: {
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [initialUser, setInitialUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');

        if (!response.ok) {
          router.push('/login');
          return;
        }

        const data = await response.json();
        setInitialUser(data.user);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (!initialUser) {
    return null;
  }

  const isAdmin = initialUser.roles.includes('admin') || initialUser.roles.includes('super_admin');

  return (
    <UserProvider initialUser={initialUser}>
      <div className="flex h-screen">
        <AdminSidebar isAdmin={isAdmin} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <AdminHeader />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
        <Toaster />
      </div>
    </UserProvider>
  );
}
