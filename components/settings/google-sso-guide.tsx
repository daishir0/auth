'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GoogleSsoGuideProps {
  redirectUri: string;
}

interface StepProps {
  stepNumber: number;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Step({ stepNumber, title, children, defaultOpen = false }: StepProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-medium">
            {stepNumber}
          </span>
          <span className="font-medium">{title}</span>
        </span>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t">
          {children}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="h-8"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-1" />
          コピー済み
        </>
      ) : (
        <>
          <Copy className="h-4 w-4 mr-1" />
          コピー
        </>
      )}
    </Button>
  );
}

export function GoogleSsoGuide({ redirectUri }: GoogleSsoGuideProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-lg">📖</span>
          <span className="font-semibold text-blue-900">Google SSO セットアップガイド</span>
        </span>
        <span className="text-sm text-blue-700">
          {isExpanded ? '折りたたむ' : '展開する'}
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          <Step stepNumber={1} title="Google Cloud Console にアクセス" defaultOpen>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://console.cloud.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Google Cloud Console
                  <ExternalLink className="h-3 w-3" />
                </a>
                を開く
              </li>
              <li>Google アカウントでログイン</li>
            </ol>
          </Step>

          <Step stepNumber={2} title="プロジェクトを作成">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>左上の「プロジェクトを選択」をクリック</li>
              <li>「新しいプロジェクト」をクリック</li>
              <li>プロジェクト名を入力（例: my-auth-project）</li>
              <li>「作成」をクリック</li>
            </ol>
            <p className="mt-2 text-sm text-amber-600">
              ※ 既存のプロジェクトを使用する場合はこのステップをスキップ
            </p>
          </Step>

          <Step stepNumber={3} title="OAuth 同意画面を設定">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>左メニュー「APIとサービス」→「OAuth 同意画面」</li>
              <li>「外部」を選択（社内のみなら「内部」）</li>
              <li>必須項目を入力:
                <ul className="ml-6 mt-1 list-disc space-y-1">
                  <li>アプリ名</li>
                  <li>ユーザーサポートメール</li>
                  <li>デベロッパーの連絡先情報</li>
                </ul>
              </li>
              <li>「保存して続行」をクリック</li>
            </ol>
          </Step>

          <Step stepNumber={4} title="OAuth クライアントIDを作成">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>左メニュー「認証情報」→「認証情報を作成」</li>
              <li>「OAuth クライアント ID」を選択</li>
              <li>アプリケーションの種類:「ウェブ アプリケーション」</li>
              <li>名前を入力（例: auth-senku-work）</li>
              <li>「承認済みのリダイレクト URI」に以下を追加:</li>
            </ol>
            <div className="mt-3 flex items-center gap-2 bg-gray-100 p-3 rounded-md">
              <code className="text-sm flex-1 break-all">{redirectUri}</code>
              <CopyButton text={redirectUri} />
            </div>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground mt-3" start={6}>
              <li>「作成」をクリック</li>
            </ol>
          </Step>

          <Step stepNumber={5} title="Client ID と Client Secret をコピー">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>作成完了画面に表示される値をコピー</li>
              <li>下のフォームに貼り付け</li>
            </ol>
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                ⚠️ Client Secret は一度しか表示されません！
              </p>
              <p className="text-xs text-amber-700 mt-1">
                ダイアログを閉じた後は再取得が必要です。必ずコピーしてから閉じてください。
              </p>
            </div>
          </Step>
        </div>
      )}
    </div>
  );
}
