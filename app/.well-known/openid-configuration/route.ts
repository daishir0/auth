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
    // 発行者
    issuer,

    // エンドポイント
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    userinfo_endpoint: `${issuer}/oauth/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    introspection_endpoint: `${issuer}/oauth/introspect`,

    // 登録エンドポイント（動的クライアント登録は未対応）
    // registration_endpoint: `${issuer}/oauth/register`,

    // サポートする機能
    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
    response_types_supported: ['code', 'token', 'id_token', 'code id_token', 'code token', 'id_token token', 'code id_token token'],
    response_modes_supported: ['query', 'fragment'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],

    // ID Token
    id_token_signing_alg_values_supported: ['RS256'],

    // 認証
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],

    // Claims
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
    ],

    // PKCE
    code_challenge_methods_supported: ['S256', 'plain'],

    // その他
    request_parameter_supported: false,
    request_uri_parameter_supported: false,
    require_request_uri_registration: false,
  };

  return NextResponse.json(configuration, {
    headers: {
      'Cache-Control': 'public, max-age=86400', // 24時間
      'Content-Type': 'application/json',
    },
  });
}
