import { test, expect } from "./fixtures";

test.describe("仪表盘", () => {
  test("显示统计卡片", async ({ page, authToken }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // 应显示统计卡片（总任务数、已完成等）
    await expect(page.getByText("总任务数").or(page.getByText("任务统计"))).toBeVisible();
  });

  test("显示快速入口按钮", async ({ page, authToken }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // 应有推理相关的入口
    await expect(
      page.getByText("图片推理").or(page.getByText("开始推理")).or(page.getByText("推理工作台")),
    ).toBeVisible();
  });

  test("侧边栏导航正常", async ({ page, authToken }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // 点击推理工作台
    await page.getByText("推理工作台").click();
    await page.waitForURL("**/inference", { timeout: 5000 });

    // 点击任务历史
    await page.getByText("任务历史").click();
    await page.waitForURL("**/tasks", { timeout: 5000 });

    // 点击仪表盘
    await page.getByText("仪表盘").first().click();
    await page.waitForURL("**/dashboard", { timeout: 5000 });
  });

  test("显示最近任务列表", async ({ page, authToken }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("最近任务")).toBeVisible();
  });
});
