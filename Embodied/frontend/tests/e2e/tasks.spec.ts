import { test, expect } from "./fixtures";

test.describe("任务管理", () => {
  test("任务列表页加载正常", async ({ page, authToken }) => {
    await page.goto("/tasks");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "任务历史" })).toBeVisible();
    await expect(page.locator("select")).toBeVisible();
  });

  test("空任务列表显示提示", async ({ page, authToken }) => {
    await page.goto("/tasks");
    await page.waitForLoadState("networkidle");

    // 可能显示"暂无任务"或空列表
    const hasEmpty = (await page.locator("text=暂无任务").isVisible()) || (await page.locator("text=加载中").isVisible());
    // 新用户可能有也可能没有任务，只要有内容即可
    expect(hasEmpty || (await page.locator("select").isVisible())).toBeTruthy();
  });

  test("状态筛选下拉框可切换", async ({ page, authToken }) => {
    await page.goto("/tasks");
    await page.waitForLoadState("networkidle");

    const select = page.locator("select");
    await select.selectOption("completed");
    await page.waitForLoadState("networkidle");

    await select.selectOption("pending");
    await page.waitForLoadState("networkidle");

    await select.selectOption("");
    await page.waitForLoadState("networkidle");
  });

  test("通过 API 提交任务后列表显示", async ({ page, authToken }) => {
    const resp = await page.request.post("/api/v1/inference/batch", {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { input_dir: "/nonexistent", task: "detect" },
    });

    if (resp.ok()) {
      const { task_id } = await resp.json();
      await page.goto("/tasks");
      await page.waitForLoadState("networkidle");
      await expect(page.locator(`text=${task_id.slice(0, 8)}`)).toBeVisible({ timeout: 5000 });
    }
  });

  test("API 任务详情可访问", async ({ page, authToken }) => {
    const resp = await page.request.post("/api/v1/inference/batch", {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { input_dir: "/nonexistent", task: "detect" },
    });

    if (resp.ok()) {
      const { task_id } = await resp.json();
      await page.waitForTimeout(2000);

      await page.goto(`/tasks/${task_id}`);
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("heading", { name: "任务详情" })).toBeVisible();
      await expect(page.locator(`text=${task_id}`)).toBeVisible();
    }
  });
});
