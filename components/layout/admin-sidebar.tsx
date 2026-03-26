'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  User,
  Users,
  Building2,
  Briefcase,
  ShieldCheck,
  AppWindow,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const mainNavItems = [
  {
    title: 'ダッシュボード',
    href: '/dashboard',
    icon: Home,
  },
  {
    title: 'プロフィール',
    href: '/profile',
    icon: User,
  },
  {
    title: '使い方',
    href: '/guide',
    icon: BookOpen,
  },
];

const adminNavItems = [
  {
    title: 'ユーザー管理',
    href: '/users',
    icon: Users,
  },
  {
    title: '組織管理',
    href: '/organizations',
    icon: Building2,
  },
  {
    title: '役職管理',
    href: '/positions',
    icon: Briefcase,
  },
  {
    title: 'アプリケーション',
    href: '/applications',
    icon: AppWindow,
  },
];

interface AdminSidebarProps {
  isAdmin: boolean;
}

export function AdminSidebar({ isAdmin }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r lg:bg-background">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">Auth Service</span>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              メニュー
            </h3>
            <ul className="space-y-1">
              {mainNavItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      pathname === item.href
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {isAdmin && (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                管理
              </h3>
              <ul className="space-y-1">
                {adminNavItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        pathname.startsWith(item.href)
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </nav>
      <div className="border-t px-4 py-3">
        <div className="text-xs text-muted-foreground">
          Auth Service v1.0
        </div>
      </div>
    </aside>
  );
}
