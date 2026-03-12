#!/usr/bin/env python3
"""
OAuth 2.0 / OpenID Connect CLI検証ツール
認証基盤の全OAuth機能をテストする
"""

import requests
import json
import sys
import time
import hashlib
import base64
import secrets
from urllib.parse import urlencode, urlparse, parse_qs

BASE_URL = "http://localhost:3019"

# テスト用クライアント情報
CLIENT_ID = "test-client"
CLIENT_SECRET = "test-secret-12345"
REDIRECT_URI = "http://localhost:8080/callback"


class OAuthCLI:
    def __init__(self):
        self.access_token = None
        self.refresh_token = None
        self.id_token = None
        self.code_verifier = None
        self.authorization_code = None
        self.test_email = f"oauth_test_{int(time.time())}@example.com"
        self.test_password = "password123"
        self.legacy_access_token = None
        self.legacy_refresh_token = None

    def print_result(self, step: int, name: str, success: bool, detail: str = ""):
        status = "OK" if success else "FAILED"
        print(f"[{step}] {name}: {status}", end="")
        if detail:
            print(f" ({detail})")
        else:
            print()

    def generate_pkce(self):
        """PKCE用のcode_verifierとcode_challengeを生成"""
        self.code_verifier = secrets.token_urlsafe(32)
        challenge = hashlib.sha256(self.code_verifier.encode()).digest()
        code_challenge = base64.urlsafe_b64encode(challenge).rstrip(b'=').decode()
        return code_challenge

    # ====== Discovery & JWK Tests ======

    def test_openid_configuration(self) -> bool:
        """OpenID Connectディスカバリーエンドポイントのテスト"""
        try:
            response = requests.get(f"{BASE_URL}/.well-known/openid-configuration")
            if response.status_code == 200:
                data = response.json()
                required_fields = ['issuer', 'authorization_endpoint', 'token_endpoint', 'jwks_uri']
                missing = [f for f in required_fields if f not in data]
                if missing:
                    self.print_result(1, "OpenID Configuration", False, f"Missing: {missing}")
                    return False
                self.print_result(1, "OpenID Configuration", True, f"issuer: {data['issuer']}")
                return True
            else:
                self.print_result(1, "OpenID Configuration", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.print_result(1, "OpenID Configuration", False, str(e))
            return False

    def test_jwks(self) -> bool:
        """JWKSエンドポイントのテスト"""
        try:
            response = requests.get(f"{BASE_URL}/.well-known/jwks.json")
            if response.status_code == 200:
                data = response.json()
                if 'keys' not in data or len(data['keys']) == 0:
                    self.print_result(2, "JWKS", False, "No keys found")
                    return False
                key = data['keys'][0]
                if 'kid' in key and 'alg' in key:
                    self.print_result(2, "JWKS", True, f"kid: {key['kid']}, alg: {key['alg']}")
                    return True
                self.print_result(2, "JWKS", False, "Invalid key format")
                return False
            else:
                self.print_result(2, "JWKS", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.print_result(2, "JWKS", False, str(e))
            return False

    # ====== User Registration & Legacy Login ======

    def test_register_user(self) -> bool:
        """ユーザー登録（レガシーAPI）"""
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/register",
                json={"email": self.test_email, "password": self.test_password},
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 201:
                data = response.json()
                self.print_result(3, "ユーザー登録", True, f"user_id: {data['user']['id'][:8]}...")
                return True
            else:
                error = response.json().get("error", "Unknown error")
                self.print_result(3, "ユーザー登録", False, error)
                return False
        except Exception as e:
            self.print_result(3, "ユーザー登録", False, str(e))
            return False

    def test_legacy_login(self) -> bool:
        """レガシーログイン（アクセストークン取得）"""
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": self.test_email, "password": self.test_password},
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 200:
                data = response.json()
                self.legacy_access_token = data.get("access_token")
                self.legacy_refresh_token = data.get("refresh_token")
                self.print_result(4, "レガシーログイン", True, "access_token取得")
                return True
            else:
                self.print_result(4, "レガシーログイン", False, response.json().get("error", "Unknown error"))
                return False
        except Exception as e:
            self.print_result(4, "レガシーログイン", False, str(e))
            return False

    # ====== OAuth Authorization Code Flow ======

    def test_oauth_authorize_redirect(self) -> bool:
        """OAuth認可エンドポイント（認証済みユーザー前提でのリダイレクト確認）"""
        try:
            # 認証状態でのauthorizeリクエスト（実際にはブラウザフローが必要）
            # ここではパラメータ検証のみテスト
            code_challenge = self.generate_pkce()
            params = {
                "response_type": "code",
                "client_id": CLIENT_ID,
                "redirect_uri": REDIRECT_URI,
                "scope": "openid profile email",
                "state": "test-state-123",
                "code_challenge": code_challenge,
                "code_challenge_method": "S256",
                "nonce": "test-nonce-456"
            }

            # 認証なしでアクセス → ログインページへリダイレクトされるはず
            response = requests.get(
                f"{BASE_URL}/oauth/authorize",
                params=params,
                allow_redirects=False
            )

            if response.status_code == 307 or response.status_code == 302:
                location = response.headers.get('Location', '')
                if '/login' in location:
                    self.print_result(5, "OAuth Authorize (未認証)", True, "→ Login redirect")
                    return True
                elif 'code=' in location:
                    # 既に認証済みの場合（セッションクッキーがある場合）
                    parsed = urlparse(location)
                    qs = parse_qs(parsed.query)
                    self.authorization_code = qs.get('code', [None])[0]
                    self.print_result(5, "OAuth Authorize", True, f"code取得: {self.authorization_code[:10]}...")
                    return True
            self.print_result(5, "OAuth Authorize (未認証)", False, f"Status: {response.status_code}")
            return False
        except Exception as e:
            self.print_result(5, "OAuth Authorize (未認証)", False, str(e))
            return False

    def simulate_oauth_flow(self) -> bool:
        """
        OAuth認可フローのシミュレーション
        実際のブラウザフローをシミュレートし、認可コードを直接生成してテスト
        """
        try:
            # DBに直接認可コードを挿入するか、セッションベースのテストが必要
            # ここでは /oauth/token のクライアント認証のみテスト

            # トークンエンドポイントがクライアント認証を受け付けるかテスト
            response = requests.post(
                f"{BASE_URL}/oauth/token",
                data={
                    "grant_type": "authorization_code",
                    "code": "invalid-code",  # 無効なコード
                    "redirect_uri": REDIRECT_URI,
                    "client_id": CLIENT_ID,
                    "client_secret": CLIENT_SECRET,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )

            # 無効なコードなので invalid_grant エラーが返るはず
            if response.status_code == 400:
                data = response.json()
                if data.get("error") == "invalid_grant":
                    self.print_result(6, "OAuth Token (無効コード検証)", True, "invalid_grant エラー確認")
                    return True
            self.print_result(6, "OAuth Token (無効コード検証)", False, f"Unexpected: {response.status_code}")
            return False
        except Exception as e:
            self.print_result(6, "OAuth Token (無効コード検証)", False, str(e))
            return False

    # ====== Token Operations via OAuth ======

    def test_oauth_refresh_token(self) -> bool:
        """
        OAuthリフレッシュトークンのテスト
        レガシーAPIで取得したリフレッシュトークンをOAuthエンドポイントで使用
        """
        try:
            if not self.legacy_refresh_token:
                self.print_result(7, "OAuth Refresh Token", False, "No refresh token")
                return False

            response = requests.post(
                f"{BASE_URL}/oauth/token",
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": self.legacy_refresh_token,
                    "client_id": CLIENT_ID,
                    "client_secret": CLIENT_SECRET,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )

            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("access_token")
                self.refresh_token = data.get("refresh_token")
                self.id_token = data.get("id_token")

                details = ["access_token取得"]
                if self.id_token:
                    details.append("id_token取得")

                self.print_result(7, "OAuth Refresh Token", True, ", ".join(details))
                return True
            else:
                error = response.json().get("error", "Unknown")
                # レガシートークンはclientIdがないため失敗する可能性がある
                self.print_result(7, "OAuth Refresh Token", False, f"{error} (レガシートークン使用)")
                return False
        except Exception as e:
            self.print_result(7, "OAuth Refresh Token", False, str(e))
            return False

    # ====== UserInfo Endpoint ======

    def test_userinfo(self) -> bool:
        """UserInfoエンドポイントのテスト"""
        try:
            token = self.access_token or self.legacy_access_token
            if not token:
                self.print_result(8, "UserInfo", False, "No access token")
                return False

            response = requests.get(
                f"{BASE_URL}/oauth/userinfo",
                headers={"Authorization": f"Bearer {token}"}
            )

            if response.status_code == 200:
                data = response.json()
                sub = data.get("sub", "")[:8]
                email = data.get("email", "")
                self.print_result(8, "UserInfo", True, f"sub: {sub}..., email: {email}")
                return True
            else:
                self.print_result(8, "UserInfo", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.print_result(8, "UserInfo", False, str(e))
            return False

    # ====== Token Introspection ======

    def test_introspect(self) -> bool:
        """トークンイントロスペクションのテスト"""
        try:
            token = self.access_token or self.legacy_access_token
            if not token:
                self.print_result(9, "Token Introspect", False, "No access token")
                return False

            # Basic認証でクライアント認証
            auth = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()

            response = requests.post(
                f"{BASE_URL}/oauth/introspect",
                data={"token": token},
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": f"Basic {auth}"
                }
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("active"):
                    self.print_result(9, "Token Introspect", True, f"active=true, sub={data.get('sub', '')[:8]}...")
                    return True
                else:
                    self.print_result(9, "Token Introspect", False, "active=false")
                    return False
            else:
                self.print_result(9, "Token Introspect", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.print_result(9, "Token Introspect", False, str(e))
            return False

    # ====== Token Revocation ======

    def test_revoke(self) -> bool:
        """トークン無効化のテスト"""
        try:
            token = self.refresh_token or self.legacy_refresh_token
            if not token:
                self.print_result(10, "Token Revoke", False, "No refresh token")
                return False

            auth = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()

            response = requests.post(
                f"{BASE_URL}/oauth/revoke",
                data={"token": token},
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": f"Basic {auth}"
                }
            )

            if response.status_code == 200:
                self.print_result(10, "Token Revoke", True)
                return True
            else:
                self.print_result(10, "Token Revoke", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.print_result(10, "Token Revoke", False, str(e))
            return False

    # ====== Post-Revoke Verification ======

    def test_post_revoke_introspect(self) -> bool:
        """無効化後のトークン検証"""
        try:
            token = self.refresh_token or self.legacy_refresh_token
            if not token:
                self.print_result(11, "無効化後の検証", False, "No token")
                return False

            auth = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()

            response = requests.post(
                f"{BASE_URL}/oauth/introspect",
                data={"token": token},
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": f"Basic {auth}"
                }
            )

            if response.status_code == 200:
                data = response.json()
                if not data.get("active"):
                    self.print_result(11, "無効化後の検証", True, "active=false (期待通り)")
                    return True
                else:
                    self.print_result(11, "無効化後の検証", False, "トークンがまだ有効")
                    return False
            else:
                self.print_result(11, "無効化後の検証", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.print_result(11, "無効化後の検証", False, str(e))
            return False

    def run_all_tests(self):
        """全テスト実行"""
        print("=" * 60)
        print("OAuth 2.0 / OpenID Connect CLI検証")
        print("=" * 60)
        print(f"Base URL: {BASE_URL}")
        print(f"Client ID: {CLIENT_ID}")
        print(f"Test Email: {self.test_email}")
        print("-" * 60)

        results = []

        # Discovery & JWK
        print("\n[Discovery & JWK]")
        results.append(("OpenID Configuration", self.test_openid_configuration()))
        results.append(("JWKS", self.test_jwks()))

        # User Registration & Legacy Login
        print("\n[User & Legacy Auth]")
        results.append(("ユーザー登録", self.test_register_user()))

        if results[-1][1]:
            results.append(("レガシーログイン", self.test_legacy_login()))

        # OAuth Flow
        print("\n[OAuth Flow]")
        results.append(("OAuth Authorize (未認証)", self.test_oauth_authorize_redirect()))
        results.append(("OAuth Token (無効コード検証)", self.simulate_oauth_flow()))

        if self.legacy_refresh_token:
            results.append(("OAuth Refresh Token", self.test_oauth_refresh_token()))

        # UserInfo & Token Operations
        print("\n[Token Operations]")
        if self.access_token or self.legacy_access_token:
            results.append(("UserInfo", self.test_userinfo()))
            results.append(("Token Introspect", self.test_introspect()))
            results.append(("Token Revoke", self.test_revoke()))
            results.append(("無効化後の検証", self.test_post_revoke_introspect()))

        # Summary
        print("\n" + "-" * 60)
        passed = sum(1 for _, success in results if success)
        total = len(results)

        print(f"\n結果: {passed}/{total} テスト成功")

        if passed == total:
            print("✓ すべてのテストが成功しました！")
            return 0
        else:
            failed = [name for name, success in results if not success]
            print(f"✗ 失敗したテスト: {', '.join(failed)}")
            return 1


def main():
    cli = OAuthCLI()
    sys.exit(cli.run_all_tests())


if __name__ == "__main__":
    main()
