import { test, expect } from "./fixtures";

const API_BASE = "http://127.0.0.1:8000/api/v1";

test.describe("认证流程", () => {
  test("注册新用户", async ({ page }) => {
    const username = `reg_${Date.now()}`;
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    // 填写注册表单
    await page.locator("input[id='username']").fill(username);
    await page.locator("input[id='password']").fill("password123");
    await page.locator("input[id='confirmPassword']").fill("password123");
    await page.getByRole("button", { name: "注册" }).click();

    // 注册成功后跳转到 dashboard
    await page.waitForURL("**/dashboard", { timeout: 10000 });
  });

  test("注册重复用户名显示错误", async ({ page }) => {
    const username = `dup_${Date.now()}`;
    // 先注册一次
    await page.request.post(`${API_BASE}/auth/register`, {
      data: { username, password: "pass123" },
    });

    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    await page.locator("input[id='username']").fill(username);
    await page.locator("input[id='password']").fill("pass123");
    await page.locator("input[id='confirmPassword']").fill("pass123");
    await page.getByRole("button", { name: "注册" }).click();

    // 应显示错误消息
    await expect(page.locator(".ant-message-notice")).toBeVisible({ timeout: 5000 });
  });

  test("登录成功跳转到仪表盘", async ({ page }) => {
    const username = `login_${Date.now()}`;
    const password = "testpass123";
    await page.request.post(`${API_BASE}/auth/register`, {
      data: { username, password },
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.locator("input[id='username']").fill(username);
    await page.locator("input[id='password']").fill(password);
    await page.getByRole("button", { name: "登录" }).click();

    await page.waitForURL("**/dashboard", { timeout: 10000 });
  });

  test("登录失败显示错误提示", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.locator("input[id='username']").fill("nobody");
    await page.locator("input[id='password']").fill("wrongpass");
    await page.getByRole("button", { name: "登录" }).click();

    await expect(page.locator(".ant-message-notice")).toBeVisible({ timeout: 5000 });
  });

  test("未登录访问首页重定向到登录页", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 10000 });
  });
});
