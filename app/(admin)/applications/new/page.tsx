'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApplicationForm } from '@/components/applications/application-form';
import { SecretDisplay } from '@/components/applications/secret-display';

export default function NewApplicationPage() {
  const router = useRouter();
  const [showSecretDialog, setShowSecretDialog] = useState(false);
  const [createdApp, setCreatedApp] = useState<{
    id: string;
    clientId: string;
    clientSecret: string;
    name: string;
  } | null>(null);

  const handleSuccess = (data: {
    id: string;
    clientId: string;
    clientSecret?: string;
    name: string;
  }) => {
    if (data.clientSecret) {
      setCreatedApp({
        id: data.id,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        name: data.name,
      });
      setShowSecretDialog(true);
    } else {
      router.push('/applications');
    }
  };

  const handleDialogClose = () => {
    setShowSecretDialog(false);
    router.push(`/applications/${createdApp?.id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">アプリケーションの新規作成</h1>
        <p className="text-muted-foreground">
          新しいOAuthクライアントアプリケーションを登録します
        </p>
      </div>

      <div className="max-w-2xl">
        <ApplicationForm onSuccess={handleSuccess} />
      </div>

      {createdApp && (
        <SecretDisplay
          open={showSecretDialog}
          onOpenChange={handleDialogClose}
          clientId={createdApp.clientId}
          clientSecret={createdApp.clientSecret}
          applicationName={createdApp.name}
          isNewApplication
        />
      )}
    </div>
  );
}
