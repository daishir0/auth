'use client';

import Link from 'next/link';
import { KeyRound, Clock, Mail } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SettingItem {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const settingItems: SettingItem[] = [
  {
    title: 'Google SSO',
    description: 'Google アカウントでのログインを設定',
    href: '/settings/google-sso',
    icon: KeyRound,
  },
  {
    title: 'トークン設定',
    description: 'アクセストークン・リフレッシュトークンの有効期限を設定',
    href: '/settings/tokens',
    icon: Clock,
  },
  {
    title: 'メール設定 (Amazon SES)',
    description: 'メール確認などのメール送信機能を設定',
    href: '/settings/ses',
    icon: Mail,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">システム設定</h1>
        <p className="text-muted-foreground">
          認証サービスの各種設定を管理します
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
