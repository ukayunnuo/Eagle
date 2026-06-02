import { test as base, expect } from "@playwright/test";

export const test = base.extend<{
  authToken: string;
}>({
  authToken: async ({ page }, use) => {
    const username = `e2e_${Date.now()}`;
    const password = "testpass123";

    // 先导航到页面，否则无法操作 localStorage
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // 注册
    const regResp = await page.request.post("/api/v1/auth/register", {
      data: { username, password },
    });
    expect(regResp.ok()).toBeTruthy();

    // 登录
    const loginResp = await page.request.post("/api/v1/auth/login", {
      data: { username, password },
    });
    expect(loginResp.ok()).toBeTruthy();
    const { access_token, refresh_token } = await loginResp.json();

    // 存入 localStorage
    await page.evaluate(
      ({ token, refresh, user }) => {
        localStorage.setItem("accessToken", token);
        localStorage.setItem("refreshToken", refresh);
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
