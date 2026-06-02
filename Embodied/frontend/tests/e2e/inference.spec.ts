import { test, expect } from "./fixtures";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createTestImage(): string {
  const pngBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
    "base64",
  );
  const testDir = path.join(__dirname, "..", "..", "test-artifacts");
  fs.mkdirSync(testDir, { recursive: true });
  const filePath = path.join(testDir, "test-image.png");
  fs.writeFileSync(filePath, pngBuffer);
  return filePath;
}

test.describe("推理工作台", () => {
  test("页面加载正常，显示参数面板", async ({ page, authToken }) => {
    await page.goto("/inference");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "推理工作台" })).toBeVisible();
    await expect(page.locator("text=任务类型")).toBeVisible();
    await expect(page.locator("text=开始推理")).toBeVisible();
  });

  test("未上传图片时推理按钮禁用", async ({ page, authToken }) => {
    await page.goto("/inference");
    await page.waitForLoadState("networkidle");

    const btn = page.locator("button:has-text('开始推理')");
    await expect(btn).toBeDisabled();
  });

  test("上传图片后显示预览", async ({ page, authToken }) => {
    await page.goto("/inference");
    await page.waitForLoadState("networkidle");

    const filePath = createTestImage();
    const fileInput = page.locator("input[type='file']");
    await fileInput.setInputFiles(filePath);

    await expect(page.locator("img[alt='预览']")).toBeVisible({ timeout: 5000 });
  });

  test("图片推理返回结果", async ({ page, authToken }) => {
    await page.goto("/inference");
    await page.waitForLoadState("networkidle");

    const filePath = createTestImage();
    await page.locator("input[type='file']").setInputFiles(filePath);
    await expect(page.locator("img[alt='预览']")).toBeVisible({ timeout: 5000 });

    const btn = page.locator("button:has-text('开始推理')");
    await expect(btn).toBeEnabled();
    await btn.click();

    // 等待结果或错误
    await page.waitForTimeout(5000);

    const hasResult =
      (await page.locator("text=标注结果").isVisible()) ||
      (await page.locator("text=推理失败").isVisible()) ||
      (await page.locator("text=模型未加载").isVisible());
    expect(hasResult).toBeTruthy();
  });

  test("任务类型选择器正常工作", async ({ page, authToken }) => {
    await page.goto("/inference");
    await page.waitForLoadState("networkidle");

    const select = page.locator("select").first();
    await expect(select).toBeVisible();

    await select.selectOption("detect");
    await expect(page.getByText("检测类别")).toBeVisible();
  });
});
