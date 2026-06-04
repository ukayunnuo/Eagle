import { test, expect } from "./fixtures";

test.describe("任务管理", () => {
  test("任务列表页加载正常", async ({ page, authToken }) => {
    await page.goto("/tasks");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("任务历史")).toBeVisible();
  });

  test("状态筛选可切换", async ({ page, authToken }) => {
    await page.goto("/tasks");
    await page.waitForLoadState("networkidle");

    // Ant Design Select 下拉框
    const select = page.locator(".ant-select").first();
    await select.click();

    // 选择"已完成"
    await page.getByTitle("已完成").or(page.locator(".ant-select-item").filter({ hasText: "已完成" })).click();
    await page.waitForLoadState("networkidle");
  });
});
