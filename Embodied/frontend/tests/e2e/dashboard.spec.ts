import { test, expect } from "./fixtures";

test.describe("仪表盘", () => {
  test("显示模型信息卡片", async ({ page, authToken }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 应显示模型名称、设备、精度
    await expect(page.locator("text=模型")).toBeVisible();
    await expect(page.locator("text=设备")).toBeVisible();
    await expect(page.locator("text=精度")).toBeVisible();
  });

  test("显示快速入口按钮", async ({ page, authToken }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=开始推理")).toBeVisible();
    await expect(page.locator("text=查看任务历史")).toBeVisible();
  });

  test("侧边栏导航正常", async ({ page, authToken }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 点击推理工作台
    await page.locator("text=推理工作台").click();
    await page.waitForURL("**/inference", { timeout: 5000 });

    // 点击任务历史
    await page.locator("text=任务历史").click();
    await page.waitForURL("**/tasks", { timeout: 5000 });

    // 点击仪表盘
    await page.locator("text=仪表盘").click();
    await page.waitForURL("**/", { timeout: 5000 });
  });

  test("显示最近任务列表", async ({ page, authToken }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 应显示"最近任务"标题
    await expect(page.locator("text=最近任务")).toBeVisible();
  });
});
