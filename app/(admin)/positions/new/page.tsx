'use client';

import Link from 'next/link';
import { ArrowLeft, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PositionForm } from '@/components/positions/position-form';

export default function NewPositionPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/positions">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Briefcase className="h-6 w-6" />
          <h1 className="text-3xl font-bold tracking-tight">役職の新規作成</h1>
        </div>
      </div>

      <PositionForm />
    </div>
  );
}
