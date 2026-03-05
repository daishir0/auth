#!/usr/bin/env python3
"""
認証マイクロサービス CLI検証ツール
"""

import requests
import json
import sys
import time

BASE_URL = "http://localhost:3019"

class AuthCLI:
    def __init__(self):
        self.access_token = None
        self.refresh_token = None
        self.test_email = f"test_cli_{int(time.time())}@example.com"
        self.test_password = "password123"

    def print_result(self, step: int, name: str, success: bool, detail: str = ""):
        status = "OK" if success else "FAILED"
        print(f"[{step}] {name}: {status}", end="")
        if detail:
            print(f" ({detail})")
        else:
            print()

    def test_register(self) -> bool:
        """ユーザー登録テスト"""
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/register",
                json={
                    "email": self.test_email,
                    "password": self.test_password
                },
                headers={"Content-Type": "application/json"}
            )

            if response.status_code == 201:
                data = response.json()
                self.print_result(1, "ユーザー登録", True, f"user_id: {data['user']['id'][:8]}...")
                return True
            else:
                self.print_result(1, "ユーザー登録", False, response.json().get("error", "Unknown error"))
                return False
        except Exception as e:
            self.print_result(1, "ユーザー登録", False, str(e))
            return False

    def test_login(self) -> bool:
        """ログインテスト"""
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={
                    "email": self.test_email,
                    "password": self.test_password
                },
                headers={"Content-Type": "application/json"}
            )

            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("access_token")
                self.refresh_token = data.get("refresh_token")
                self.print_result(2, "ログイン", True, "access_token取得")
                return True
            else:
                self.print_result(2, "ログイン", False, response.json().get("error", "Unknown error"))
                return False
        except Exception as e:
            self.print_result(2, "ログイン", False, str(e))
            return False

    def test_verify(self) -> bool:
        """トークン検証テスト"""
        try:
            response = requests.get(
                f"{BASE_URL}/api/auth/verify",
                headers={
                    "Authorization": f"Bearer {self.access_token}"
                }
            )

            if response.status_code == 200:
                data = response.json()
                user_id = data.get("user", {}).get("userId", "")
                self.print_result(3, "トークン検証", True, f"user_id確認: {user_id[:8]}...")
                return True
            else:
                self.print_result(3, "トークン検証", False, response.json().get("error", "Unknown error"))
                return False
        except Exception as e:
            self.print_result(3, "トークン検証", False, str(e))
            return False

    def test_me(self) -> bool:
        """ユーザー情報取得テスト"""
        try:
            response = requests.get(
                f"{BASE_URL}/api/auth/me",
                headers={
                    "Authorization": f"Bearer {self.access_token}"
                }
            )

            if response.status_code == 200:
                data = response.json()
                email = data.get("user", {}).get("email", "")
                self.print_result(4, "ユーザー情報取得", True, f"email確認: {email}")
                return True
            else:
                self.print_result(4, "ユーザー情報取得", False, response.json().get("error", "Unknown error"))
                return False
        except Exception as e:
            self.print_result(4, "ユーザー情報取得", False, str(e))
            return False

    def test_refresh(self) -> bool:
        """トークン更新テスト"""
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/refresh",
                json={
                    "refresh_token": self.refresh_token
                },
                headers={"Content-Type": "application/json"}
            )

            if response.status_code == 200:
                data = response.json()
                old_access = self.access_token[:10]
                self.access_token = data.get("access_token")
                self.refresh_token = data.get("refresh_token")
                new_access = self.access_token[:10] if self.access_token else ""
                self.print_result(5, "トークン更新", True, f"新access_token取得 ({old_access}... -> {new_access}...)")
                return True
            else:
                self.print_result(5, "トークン更新", False, response.json().get("error", "Unknown error"))
                return False
        except Exception as e:
            self.print_result(5, "トークン更新", False, str(e))
            return False

    def test_logout(self) -> bool:
        """ログアウトテスト"""
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/logout",
                json={
                    "refresh_token": self.refresh_token
                },
                headers={
                    "Content-Type": "application/json"
                }
            )

            if response.status_code == 200:
                self.print_result(6, "ログアウト", True)
                return True
            else:
                self.print_result(6, "ログアウト", False, response.json().get("error", "Unknown error"))
                return False
        except Exception as e:
            self.print_result(6, "ログアウト", False, str(e))
            return False

    def test_post_logout_verify(self) -> bool:
        """ログアウト後の検証（旧トークンが無効化されていることを確認）"""
        try:
            # 旧リフレッシュトークンで更新を試みる
            response = requests.post(
                f"{BASE_URL}/api/auth/refresh",
                json={
                    "refresh_token": self.refresh_token
                },
                headers={"Content-Type": "application/json"}
            )

            # 401が返ってくることを期待
            if response.status_code == 401:
                self.print_result(7, "ログアウト後の検証", True, "401 Unauthorized (期待通り)")
                return True
            else:
                self.print_result(7, "ログアウト後の検証", False, f"Expected 401, got {response.status_code}")
                return False
        except Exception as e:
            self.print_result(7, "ログアウト後の検証", False, str(e))
            return False

    def run_all_tests(self):
        """全テスト実行"""
        print("=" * 50)
        print("認証マイクロサービス CLI検証")
        print("=" * 50)
        print(f"Base URL: {BASE_URL}")
        print(f"Test Email: {self.test_email}")
        print("-" * 50)

        results = []

        # 各テストを順番に実行
        results.append(("ユーザー登録", self.test_register()))

        if results[-1][1]:
            results.append(("ログイン", self.test_login()))

        if len(results) > 1 and results[-1][1]:
            results.append(("トークン検証", self.test_verify()))
            results.append(("ユーザー情報取得", self.test_me()))
            results.append(("トークン更新", self.test_refresh()))
            results.append(("ログアウト", self.test_logout()))
            results.append(("ログアウト後の検証", self.test_post_logout_verify()))

        print("-" * 50)

        # 結果サマリー
        passed = sum(1 for _, success in results if success)
        total = len(results)

        print(f"\n結果: {passed}/{total} テスト成功")

        if passed == total:
            print("✓ すべてのテストが成功しました！")
            return 0
        else:
            print("✗ 一部のテストが失敗しました")
            return 1


def main():
    cli = AuthCLI()
    sys.exit(cli.run_all_tests())


if __name__ == "__main__":
    main()
