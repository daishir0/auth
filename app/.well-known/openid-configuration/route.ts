/**
 * OpenID Connect Discovery エンドポイント
 * RFC 8414: OAuth 2.0 Authorization Server Metadata
 * クライアントがサーバーの設定を自動検出できるようにする
 */

import { NextResponse } from 'next/server';
import { getIssuer } from '@/lib/oauth-auth';

export async function GET() {
  const issuer = getIssuer();

  const configuration = {
    issuer,

    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    userinfo_endpoint: `${issuer}/oauth/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    introspection_endpoint: `${issuer}/oauth/introspect`,

    // 実装済みのもののみ宣言する
    scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'custom'],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],

    id_token_signing_alg_values_supported: ['RS256'],

    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],

    revocation_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    introspection_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],

    claims_supported: [
      'sub',
      'iss',
      'aud',
      'exp',
      'iat',
      'auth_time',
      'nonce',
      'email',
      'email_verified',
      'name',
      'roles',
      'organizations',
    ],

    // PKCE（S256のみ。plainは平文で安全性が低いため未サポート）
    code_challenge_methods_supported: ['S256'],

    request_parameter_supported: false,
    request_uri_parameter_supported: false,
    require_request_uri_registration: false,
  };

  return NextResponse.json(configuration, {
    headers: {
      'Cache-Control': 'public, max-age=86400',
      'Content-Type': 'application/json',
    },
  });
}
