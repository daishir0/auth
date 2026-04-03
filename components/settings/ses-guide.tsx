'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Copy, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

const iamPolicy = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}`;

export function SesGuide() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-lg">📖</span>
          <span className="font-semibold text-orange-900">Amazon SES セットアップガイド</span>
        </span>
        <span className="text-sm text-orange-700">
          {isExpanded ? '折りたたむ' : '展開する'}
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* 前提条件 */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 font-medium">前提条件</p>
            <p className="text-xs text-blue-700 mt-1">
              AWS アカウントが必要です。お持ちでない場合は{' '}
              <a
                href="https://portal.aws.amazon.com/billing/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                こちら
                <ExternalLink className="h-3 w-3" />
              </a>
              から無料で作成できます。
            </p>
          </div>

          <Step stepNumber={1} title="AWS Console にログイン" defaultOpen>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://console.aws.amazon.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  AWS Management Console
                  <ExternalLink className="h-3 w-3" />
                </a>
                を開く
              </li>
              <li>AWS アカウントでログイン</li>
              <li>右上のリージョン選択で「アジアパシフィック (東京)」を選択</li>
            </ol>
            <div className="mt-3 p-3 bg-gray-100 rounded-md">
              <p className="text-xs text-muted-foreground">
                リージョンは後で設定画面で指定するものと同じにしてください。
                日本国内向けサービスの場合は「ap-northeast-1（東京）」が推奨です。
              </p>
            </div>
          </Step>

          <Step stepNumber={2} title="IAM ユーザーを作成">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>検索バーで「IAM」と入力し、IAM を開く</li>
              <li>左メニュー「ユーザー」→「ユーザーを作成」</li>
              <li>ユーザー名を入力（例: ses-auth-service）</li>
              <li>「次へ」をクリック</li>
            </ol>
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                セキュリティのポイント
              </p>
              <p className="text-xs text-amber-700 mt-1">
                SES 専用のユーザーを作成し、最小限の権限のみを付与することを推奨します。
                ルートアカウントや管理者アカウントの認証情報は使用しないでください。
              </p>
            </div>
          </Step>

          <Step stepNumber={3} title="SES 送信ポリシーを設定">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>「許可のオプション」で「ポリシーを直接アタッチする」を選択</li>
              <li>「ポリシーの作成」をクリック（新しいタブが開きます）</li>
              <li>「JSON」タブをクリック</li>
              <li>以下のポリシーを貼り付け:</li>
            </ol>
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-2 bg-gray-100 p-3 rounded-md">
                <pre className="text-xs flex-1 overflow-x-auto">{iamPolicy}</pre>
                <CopyButton text={iamPolicy} />
              </div>
            </div>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground mt-3" start={5}>
              <li>「次へ」→ ポリシー名を入力（例: SES-SendEmail-Policy）</li>
              <li>「ポリシーの作成」をクリック</li>
              <li>元のタブに戻り、更新ボタンを押して作成したポリシーを選択</li>
              <li>「次へ」→「ユーザーの作成」</li>
            </ol>
          </Step>

          <Step stepNumber={4} title="Access Key を取得">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>作成したユーザーをクリック</li>
              <li>「セキュリティ認証情報」タブを開く</li>
              <li>「アクセスキー」→「アクセスキーを作成」</li>
              <li>「AWS の外部で実行されるアプリケーション」を選択</li>
              <li>「次へ」→「アクセスキーを作成」</li>
              <li>
                <strong>Access Key ID</strong> と <strong>Secret Access Key</strong> をコピー
              </li>
            </ol>
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800 font-medium flex items-center gap-2">
                ⚠️ Secret Access Key は一度しか表示されません！
              </p>
              <p className="text-xs text-red-700 mt-1">
                この画面を閉じると二度と表示されません。必ず両方の値をコピーしてから閉じてください。
                紛失した場合は新しいアクセスキーを作成し直す必要があります。
              </p>
            </div>
          </Step>

          <Step stepNumber={5} title="送信元メールアドレスを検証">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>検索バーで「SES」と入力し、Amazon SES を開く</li>
              <li>左メニュー「設定」→「ID」→「ID の作成」</li>
              <li>「E メールアドレス」を選択</li>
              <li>使用するメールアドレスを入力（例: noreply@example.com）</li>
              <li>「ID の作成」をクリック</li>
              <li>入力したメールアドレスに確認メールが届く</li>
              <li>メール内のリンクをクリックして検証完了</li>
            </ol>
            <div className="mt-3 p-3 bg-gray-100 rounded-md">
              <p className="text-xs text-muted-foreground">
                <strong>ドメイン全体を検証する場合:</strong><br />
                「ドメイン」を選択し、DNS レコードを設定します。
                これにより、そのドメインの任意のアドレスから送信可能になります。
              </p>
            </div>
          </Step>

          <Step stepNumber={6} title="（オプション）サンドボックスを解除">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md mb-3">
              <p className="text-sm text-blue-800 font-medium">サンドボックスモードとは？</p>
              <p className="text-xs text-blue-700 mt-1">
                新規アカウントは「サンドボックス」モードで、検証済みのメールアドレスにのみ送信可能です。
                本番環境では解除申請が必要です。テスト段階ではこのままでOKです。
              </p>
            </div>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>左メニュー「アカウントダッシュボード」を開く</li>
              <li>「本番稼働用アクセスのリクエスト」をクリック</li>
              <li>必要事項を入力:
                <ul className="ml-6 mt-1 list-disc space-y-1">
                  <li>メールの種類: トランザクション</li>
                  <li>ウェブサイトの URL</li>
                  <li>ユースケースの説明</li>
                </ul>
              </li>
              <li>「リクエストを送信」</li>
            </ol>
            <p className="mt-2 text-sm text-muted-foreground">
              通常 24 時間以内に審査結果がメールで届きます。
            </p>
          </Step>

          <Step stepNumber={7} title="下のフォームに入力">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>取得した情報を下のフォームに入力:</li>
            </ol>
            <ul className="ml-6 mt-2 space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="w-40 font-medium">AWS リージョン</span>
                <span className="text-muted-foreground">→ 東京なら「ap-northeast-1」</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-40 font-medium">Access Key ID</span>
                <span className="text-muted-foreground">→ ステップ4で取得した値</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-40 font-medium">Secret Access Key</span>
                <span className="text-muted-foreground">→ ステップ4で取得した値</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-40 font-medium">送信元メールアドレス</span>
                <span className="text-muted-foreground">→ ステップ5で検証したアドレス</span>
              </li>
            </ul>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground mt-3" start={2}>
              <li>「メール送信を有効にする」をオン</li>
              <li>「設定を保存」をクリック</li>
              <li>「テストメール送信」で動作確認</li>
            </ol>
          </Step>
        </div>
      )}
    </div>
  );
}
