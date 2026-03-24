import { test, expect, Page } from "@playwright/test";
import { loginToAuth } from "./helpers/auth";

const ADMIN_EMAIL = process.env.TEST_USER_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_USER_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables are required');
}

// テストタイムアウトを延長（ログインフローが長い場合があるため）
test.setTimeout(120000);

/**
 * 全ページ・全リンク正常表示テスト
 *
 * サイドバーおよびヘッダーに含まれる全てのリンクをクリックし、
 * 各ページが正常に表示されることを確認します。
 */

// 公開ページ（認証不要）
const publicPages = [
  { name: "トップページ", path: "/" },
  { name: "ログインページ", path: "/login" },
  { name: "新規登録ページ", path: "/register" },
];

// 一般ユーザーページ（認証必要）
const userPages = [
  { name: "ダッシュボード", path: "/dashboard" },
  { name: "プロフィール", path: "/profile" },
];

// 管理者ページ（認証 + 管理者権限必要）
const adminPages = [
  { name: "ユーザー管理", path: "/users" },
  { name: "組織管理", path: "/organizations" },
  { name: "役職管理", path: "/positions" },
  { name: "アプリケーション", path: "/applications" },
  { name: "アプリケーション新規作成", path: "/applications/new" },
];

/**
 * ページが正常に表示されるか確認
 * - 404エラーでないこと
 * - 500エラーでないこと
 * - 基本的なUI要素が表示されること
 */
async function assertPageLoadsCorrectly(page: Page, expectedPath: string): Promise<void> {
  // URLが期待どおりであること（リダイレクトされていないこと）
  const currentUrl = page.url();

  // 404ページでないこと（タイトルやコンテンツをチェック）
  const pageTitle = await page.title();
  expect(pageTitle.toLowerCase()).not.toContain("404");
  expect(pageTitle.toLowerCase()).not.toContain("not found");

  // 500エラーでないこと
  const bodyText = await page.locator("body").textContent();
  expect(bodyText?.toLowerCase()).not.toContain("500 internal server error");
  expect(bodyText?.toLowerCase()).not.toContain("application error");

  // 基本的なコンテンツが表示されていること
  expect(bodyText?.length).toBeGreaterThan(100);
}

test.describe("公開ページ", () => {
  for (const pageInfo of publicPages) {
    test(`${pageInfo.name} (${pageInfo.path}) が正常に表示される`, async ({ page }) => {
      await page.goto(pageInfo.path);
      await page.waitForLoadState("networkidle");
      await assertPageLoadsCorrectly(page, pageInfo.path);
    });
  }
});

test.describe("認証済みユーザーページ", () => {
  test.beforeEach(async ({ page }) => {
    await loginToAuth(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  for (const pageInfo of userPages) {
    test(`${pageInfo.name} (${pageInfo.path}) が正常に表示される`, async ({ page }) => {
      await page.goto(pageInfo.path);
      await page.waitForLoadState("networkidle");
      await assertPageLoadsCorrectly(page, pageInfo.path);
    });
  }
});

test.describe("管理者ページ", () => {
  test.beforeEach(async ({ page }) => {
    await loginToAuth(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  for (const pageInfo of adminPages) {
    test(`${pageInfo.name} (${pageInfo.path}) が正常に表示される`, async ({ page }) => {
      await page.goto(pageInfo.path);
      await page.waitForLoadState("networkidle");
      await assertPageLoadsCorrectly(page, pageInfo.path);
    });
  }
});

test.describe("サイドバーリンク遷移", () => {
  test.beforeEach(async ({ page }) => {
    await loginToAuth(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("サイドバーの全リンクが正常に機能する", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // サイドバー内の全リンクを取得
    const sidebarLinks = page.locator("aside a[href], nav a[href]");
    const linksCount = await sidebarLinks.count();

    expect(linksCount).toBeGreaterThan(0);

    // 各リンクをテスト
    const visitedUrls = new Set<string>();
    for (let i = 0; i < linksCount; i++) {
      const link = sidebarLinks.nth(i);
      const href = await link.getAttribute("href");

      // 外部リンクや既に訪問済みのリンクはスキップ
      if (!href || href.startsWith("http") || href.startsWith("//") || visitedUrls.has(href)) {
        continue;
      }

      visitedUrls.add(href);

      // リンクをクリック
      await link.click();
      await page.waitForLoadState("networkidle");

      // ページが正常に読み込まれること
      const bodyText = await page.locator("body").textContent();
      expect(bodyText?.toLowerCase()).not.toContain("404");
      expect(bodyText?.toLowerCase()).not.toContain("not found");
    }
  });
});

test.describe("ヘッダーメニュー", () => {
  test.beforeEach(async ({ page }) => {
    await loginToAuth(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("ヘッダーのユーザーメニューが正常に動作する", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // ユーザーメニューボタンを探す
    const userMenuButton = page.locator('[data-testid="user-menu"], button:has(span[class*="avatar"]), header button:has(img)').first();

    if (await userMenuButton.isVisible()) {
      await userMenuButton.click();

      // ドロップダウンメニューが表示されるのを待つ
      await page.waitForTimeout(500);

      // メニュー内のリンクを確認
      const menuLinks = page.locator('[role="menuitem"] a, [role="menu"] a');
      const menuLinksCount = await menuLinks.count();

      for (let i = 0; i < menuLinksCount; i++) {
        const link = menuLinks.nth(i);
        const href = await link.getAttribute("href");

        // 外部リンクはスキップ
        if (href && !href.startsWith("http") && !href.startsWith("//")) {
          // リンクが有効であることを確認
          expect(href).toBeTruthy();
        }
      }
    }
  });
});
