'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Building2, Briefcase, ShieldCheck, ExternalLink, AppWindow } from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalOrganizations: number;
  totalPositions: number;
}

interface UserInfo {
  id: string;
  email: string;
  roles: string[];
  profile?: {
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
  organizations: Array<{
    id: string;
    name: string;
    code: string;
    isPrimary: boolean;
    position?: {
      id: string;
      name: string;
      code: string;
    } | null;
  }>;
  createdAt: string;
}

interface MyApplication {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  appUrl: string | null;
  iconUrl: string | null;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [myApps, setMyApps] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, statsRes, appsRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/admin/stats'),
          fetch('/api/auth/me/applications'),
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.user);
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        if (appsRes.ok) {
          const appsData = await appsRes.json();
          setMyApps(appsData.applications);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = user?.roles.includes('admin') || user?.roles.includes('super_admin');
  const primaryOrg = user?.organizations.find((org) => org.isPrimary);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ダッシュボード</h1>
        <p className="text-muted-foreground">
          Auth Service の管理画面へようこそ
        </p>
      </div>

      {/* ユーザー情報カード */}
      <Card>
        <CardHeader>
          <CardTitle>ログイン中のユーザー</CardTitle>
          <CardDescription>あなたのアカウント情報</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">メールアドレス</p>
                <p className="text-sm">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">表示名</p>
                <p className="text-sm">
                  {user?.profile?.displayName ||
                    (user?.profile?.firstName && user?.profile?.lastName
                      ? `${user.profile.lastName} ${user.profile.firstName}`
                      : '未設定')}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">ロール</p>
                <div className="flex gap-1 mt-1">
                  {user?.roles.map((role) => (
                    <Badge key={role} variant="secondary">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">主所属</p>
                <p className="text-sm">
                  {primaryOrg
                    ? `${primaryOrg.name}${primaryOrg.position ? ` / ${primaryOrg.position.name}` : ''}`
                    : '未設定'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 管理者向け統計 */}
      {isAdmin && stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総ユーザー数</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                アクティブ: {stats.activeUsers}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">組織数</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrganizations}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">役職数</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPositions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ロール数</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">
                super_admin, admin, user
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* アプリケーション一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AppWindow className="h-5 w-5" />
            あなたが利用できるアプリケーション
          </CardTitle>
          <CardDescription>
            アクセス権が付与されているアプリケーション一覧
          </CardDescription>
        </CardHeader>
        <CardContent>
          {myApps.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                利用可能なアプリケーションがありません
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                アクセス権がないアプリは管理者にお問い合わせください
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myApps.map((app) => (
                <Card key={app.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{app.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {app.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {app.description}
                      </p>
                    )}
                    {app.appUrl ? (
                      <Button asChild className="w-full">
                        <a href={app.appUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          開く
                        </a>
                      </Button>
                    ) : (
                      <Button disabled className="w-full">
                        URLが設定されていません
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
