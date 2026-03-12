import { Suspense } from 'react';
import AuthForm from '@/components/AuthForm';

function RegisterLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-gray-500">Loading...</div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterLoading />}>
      <AuthForm mode="register" />
    </Suspense>
  );
}
