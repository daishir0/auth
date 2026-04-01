import { NextResponse } from 'next/server';
import { isGoogleSsoEnabled } from '@/lib/settings';

/**
 * GET /api/auth/google/status
 * Google SSOが有効かどうかを返す（認証不要）
 */
export async function GET() {
  try {
    const enabled = await isGoogleSsoEnabled();
    return NextResponse.json({ enabled });
  } catch (error) {
    console.error('Failed to check Google SSO status:', error);
    return NextResponse.json({ enabled: false });
  }
}
