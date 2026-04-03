'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SesGuide } from '@/components/settings/ses-guide';
import { SesForm } from '@/components/settings/ses-form';

export default function SesSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">メール設定 (Amazon SES)</h1>
          <p className="text-muted-foreground">
            メール確認などのメール送信機能を設定します
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <SesGuide />

        <Card>
          <CardHeader>
            <CardTitle>設定</CardTitle>
            <CardDescription>
              上記ガイドで取得した AWS 認証情報を入力してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SesForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
