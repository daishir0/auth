import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Auth Service',
  description: 'Authentication microservice for Papernote',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-100">{children}</body>
    </html>
  );
}
