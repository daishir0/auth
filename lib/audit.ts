/**
 * セキュリティ監査ログ用ヘルパー
 *
 * IP/UA/details を統一フォーマットで SecurityLog に記録する。
 * PII（トークン全文）はログに含めない方針。
 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export type AuditAction =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'token_issued'
  | 'token_refreshed'
  | 'token_revoked'
  | 'oauth_authorize_request'
  | 'oauth_authorize_consent';

interface AuditOptions {
  action: AuditAction;
  userId?: string | null;
  request?: NextRequest;
  details?: Record<string, unknown>;
}

function getClientIp(request?: NextRequest): string | null {
  if (!request) return null;
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  );
}

export async function logSecurityEvent(opts: AuditOptions): Promise<void> {
  try {
    await prisma.securityLog.create({
      data: {
        action: opts.action,
        userId: opts.userId ?? null,
        ipAddress: getClientIp(opts.request) ?? undefined,
        userAgent: opts.request?.headers.get('user-agent') ?? undefined,
        details: (opts.details ?? {}) as object,
      },
    });
  } catch (error) {
    // 監査ログ失敗はサービス継続のためログのみ
    console.error('[audit] logSecurityEvent failed:', error);
  }
}
