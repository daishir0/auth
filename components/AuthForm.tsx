'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail } from 'lucide-react';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';

interface AuthFormProps {
  mode: 'login' | 'register';
}

interface RegistrationSuccess {
  success: boolean;
  message: string;
  type: 'register' | 'add_password';
}

/**
 * リダイレクトURLの安全性を検証
 * 同一ドメインまたは相対パスのみ許可（オープンリダイレクト脆弱性対策）
 */
function isValidRedirectUrl(url: string | null): boolean {
  if (!url) return false;

  // 相対パス（/で始まる）は許可
  if (url.startsWith('/') && !url.startsWith('//')) {
    return true;
  }

  try {
    const parsed = new URL(url);
    const currentHost = typeof window !== 'undefined' ? window.location.host : '';

    // 同一ドメインのみ許可
    if (parsed.host === currentHost) {
      return true;
    }

    // 許可されたドメインリスト（OAuth認可フロー用）
    // 環境変数から取得（カンマ区切り）
    const allowedHosts = (process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_HOSTS || '')
      .split(',')
      .map(h => h.trim())
      .filter(Boolean);

    return allowedHosts.includes(parsed.host);
  } catch {
    // URL解析失敗は不正とみなす
    return false;
  }
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleSsoEnabled, setGoogleSsoEnabled] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState<RegistrationSuccess | null>(null);

  useEffect(() => {
    // Google SSOの状態を取得
    fetch('/api/auth/google/status')
      .then((res) => res.json())
      .then((data) => setGoogleSsoEnabled(data.enabled))
      .catch(() => setGoogleSsoEnabled(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'An error occurred');
        return;
      }

      if (mode === 'register') {
        // 登録成功 → メール確認待ち画面を表示
        setRegistrationSuccess({
          success: data.success,
          message: data.message,
          type: data.type,
        });
      } else {
        // ログイン成功後、redirectがあればそこへ、なければダッシュボードへ
        if (isValidRedirectUrl(redirectUrl)) {
          // 検証済みの安全なリダイレクト
          window.location.href = redirectUrl!;
        } else {
          router.push('/dashboard');
          router.refresh();
        }
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 登録成功時のメール確認待ち画面
  if (registrationSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="max-w-md w-full space-y-6 p-8 bg-white rounded-lg shadow-md text-center">
          <div className="flex justify-center">
            <div className="p-4 bg-blue-100 rounded-full">
              <Mail className="h-12 w-12 text-blue-600" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              確認メールを送信しました
            </h2>
            <p className="mt-4 text-gray-600">
              <span className="font-medium text-gray-900">{email}</span> に確認メールを送信しました。
            </p>
            <p className="mt-2 text-gray-600">
              {registrationSuccess.type === 'register'
                ? 'メール内のリンクをクリックして、アカウント登録を完了してください。'
                : 'メール内のリンクをクリックして、パスワードの設定を完了してください。'}
            </p>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              メールが届かない場合は、迷惑メールフォルダをご確認ください。
            </p>
          </div>
          <div>
            <a
              href="/login"
              className="text-blue-600 hover:text-blue-500 text-sm font-medium"
            >
              ログインページへ戻る
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </h2>
        </div>

        {googleSsoEnabled && (
          <div className="space-y-4">
            <GoogleLoginButton
              redirectUrl={redirectUrl || undefined}
              disabled={loading}
            />
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">または</span>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : mode === 'login' ? 'Sign in' : 'Sign up'}
            </button>
          </div>

          <div className="text-center">
            {mode === 'login' ? (
              <p className="text-sm text-gray-600">
                Don&apos;t have an account?{' '}
                <a href="/register" className="font-medium text-blue-600 hover:text-blue-500">
                  Sign up
                </a>
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <a href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                  Sign in
                </a>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
