import { test, expect } from "./fixtures";

test.describe("推理工作台", () => {
  test("页面加载正常", async ({ page, authToken }) => {
    await page.goto("/inference");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("推理工作台")).toBeVisible();
  });

  test("上传图片后显示预览", async ({ page, authToken }) => {
    await page.goto("/inference");
    await page.waitForLoadState("networkidle");

    // 创建一个最小的 1x1 PNG
    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    const buffer = Buffer.from(pngBase64, "base64");

    const fileInput = page.locator("input[type='file']");
    await fileInput.setInputFiles({
      name: "test-image.png",
      mimeType: "image/png",
      buffer,
    });

    // 等待图片预览出现
    await page.waitForTimeout(1000);
    const images = page.locator("img");
    const count = await images.count();
    expect(count).toBeGreaterThan(0);
  });
});
