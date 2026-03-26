import { Page } from "@playwright/test";

// テスト用ユーザー情報（環境変数から取得 - 必須）
const ADMIN_EMAIL = process.env.TEST_USER_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.TEST_USER_PASSWORD ?? '';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables are required');
}

/**
 * Auth サービスにログインする
 */
export async function loginToAuth(
  page: Page,
  email: string = ADMIN_EMAIL,
  password: string = ADMIN_PASSWORD
): Promise<void> {
  // 既存のセッションをクリア
  await page.context().clearCookies();

  // ログインページに移動
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  // ログインフォームに入力
  const emailInput = page.locator('input[type="email"], input[name="email"], #email');
  const passwordInput = page.locator('input[type="password"], input[name="password"], #password');

  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.fill(email);
  await passwordInput.fill(password);

  // Enterキーで送信
  await passwordInput.press("Enter");

  // ダッシュボードへのリダイレクトを待つ
  await page.waitForURL(/\/(dashboard|profile|users|organizations)/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

/**
 * 簡易ログインチェック
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    return !page.url().includes("/login");
  } catch {
    return false;
  }
}
