'use client';

import { useState } from 'react';
import { Copy, Check, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface SecretDisplayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientSecret: string;
  applicationName: string;
  isNewApplication?: boolean;
}

export function SecretDisplay({
  open,
  onOpenChange,
  clientId,
  clientSecret,
  applicationName,
  isNewApplication = false,
}: SecretDisplayProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyEnvFormat = async () => {
    const envFormat = `# ${applicationName}
OAUTH_CLIENT_ID=${clientId}
OAUTH_CLIENT_SECRET=${clientSecret}`;
    await handleCopy(envFormat, 'env');
  };

  const maskedSecret = showSecret
    ? clientSecret
    : clientSecret.substring(0, 8) + '•'.repeat(clientSecret.length - 8);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isNewApplication ? 'アプリケーションが作成されました' : 'シークレットが再生成されました'}
          </DialogTitle>
          <DialogDescription>
            以下の認証情報を安全な場所に保存してください。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-medium">重要</p>
                  <p className="mt-1">
                    クライアントシークレットは再度表示されません。
                    必ずこの画面を閉じる前にコピーしてください。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Client ID</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                  {clientId}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(clientId, 'clientId')}
                >
                  {copiedField === 'clientId' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Client Secret</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                  {maskedSecret}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(clientSecret, 'clientSecret')}
                >
                  {copiedField === 'clientSecret' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleCopyEnvFormat}
            >
              {copiedField === 'env' ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  コピーしました
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  環境変数形式でコピー
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
