/**
 * JWK Set エンドポイント
 * RFC 7517: JSON Web Key (JWK)
 * 公開鍵を配布して、外部システムがトークンを検証できるようにする
 */

import { NextResponse } from 'next/server';
import { getPublicKeyAsJwk } from '@/lib/oauth-auth';

// キャッシュヘッダー（1時間）
const CACHE_MAX_AGE = 3600;

export async function GET() {
  try {
    const jwk = await getPublicKeyAsJwk();

    return NextResponse.json(
      {
        keys: [jwk],
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('JWK endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve JWK' },
      { status: 500 }
    );
  }
}
