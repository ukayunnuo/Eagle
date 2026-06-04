import { test as base, expect } from "@playwright/test";

const API_BASE = "http://127.0.0.1:8000/api/v1";

export const test = base.extend<{
  authToken: string;
}>({
  authToken: async ({ page }, use) => {
    const username = `e2e_${Date.now()}`;
    const password = "testpass123";

    // 注册
    const regResp = await page.request.post(`${API_BASE}/auth/register`, {
      data: { username, password },
    });
    expect(regResp.ok()).toBeTruthy();

    // 登录
    const loginResp = await page.request.post(`${API_BASE}/auth/login`, {
      data: { username, password },
    });
    expect(loginResp.ok()).toBeTruthy();
    const { access_token, refresh_token } = await loginResp.json();

    // 先导航到页面，否则无法操作 localStorage
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // 存入 localStorage（与前端 client.ts 一致的 key）
    await page.evaluate(
      ({ token, refresh, user }) => {
        localStorage.setItem("access_token", token);
        localStorage.setItem("refresh_token", refresh);
        localStorage.setItem(
          "user",
          JSON.stringify({ id: 0, username: user, created_at: "" }),
        );
      },
      { token: access_token, refresh: refresh_token, user: username },
    );

    await use(access_token);
  },
});

export { expect };
