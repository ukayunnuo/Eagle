import { test, expect } from "./fixtures";

test.describe("认证流程", () => {
  test("注册新用户", async ({ page }) => {
    const username = `reg_${Date.now()}`;
    await page.goto("/register");

    await page.locator("input[type='text']").fill(username);
    await page.locator("input[type='password']").fill("password123");
    await page.locator("button[type='submit']").click();

    // 注册成功后跳转到登录页
    await page.waitForURL("**/login", { timeout: 5000 });
    await expect(page.locator("h1")).toContainText("LocateAnything");
  });

  test("注册重复用户名显示错误", async ({ page }) => {
    const username = `dup_${Date.now()}`;
    // 先注册一次
    await page.request.post("/api/v1/auth/register", {
      data: { username, password: "pass123" },
    });

    await page.goto("/register");
    await page.locator("input[type='text']").fill(username);
    await page.locator("input[type='password']").fill("pass123");
    await page.locator("button[type='submit']").click();

    await expect(page.locator("text=注册失败").or(page.locator("text=已存在"))).toBeVisible({
      timeout: 5000,
    });
  });

  test("登录成功跳转到仪表盘", async ({ page }) => {
    const username = `login_${Date.now()}`;
    const password = "testpass123";
    await page.request.post("/api/v1/auth/register", {
      data: { username, password },
    });

    await page.goto("/login");
    await page.locator("input[type='text']").fill(username);
    await page.locator("input[type='password']").fill(password);
    await page.locator("button[type='submit']").click();

    await page.waitForURL("**/", { timeout: 5000 });
    await expect(page.getByRole("heading", { name: "仪表盘" })).toBeVisible();
  });

  test("登录失败显示错误提示", async ({ page }) => {
    await page.goto("/login");
    await page.locator("input[type='text']").fill("nobody");
    await page.locator("input[type='password']").fill("wrongpass");
    await page.locator("button[type='submit']").click();

    await expect(page.locator("text=用户名或密码错误")).toBeVisible({ timeout: 5000 });
  });

  test("未登录访问首页重定向到登录页", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/login", { timeout: 5000 });
  });

  test("登出后重定向到登录页", async ({ page, authToken }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 点击退出按钮
    await page.locator("[title='退出登录']").click();
    await page.waitForURL("**/login", { timeout: 5000 });
  });
});
