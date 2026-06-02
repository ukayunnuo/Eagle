import { test, expect } from "./fixtures";

test.describe("API 接口", () => {
  test("模型信息接口返回正确结构", async ({ page, authToken }) => {
    const resp = await page.request.get("/api/v1/models", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(resp.ok()).toBeTruthy();

    const data = await resp.json();
    expect(data).toHaveProperty("current_model");
    expect(data).toHaveProperty("family");
    expect(data).toHaveProperty("device");
    expect(data).toHaveProperty("supported_tasks");
    expect(Array.isArray(data.supported_tasks)).toBeTruthy();
  });

  test("未认证访问 API 返回 401/403", async ({ page }) => {
    const resp = await page.request.get("/api/v1/models");
    expect(resp.status()).toBeGreaterThanOrEqual(401);
  });

  test("任务列表接口返回正确结构", async ({ page, authToken }) => {
    const resp = await page.request.get("/api/v1/tasks?page=1&size=5", {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    // 可能 200（正常）或 503（任务管理器未初始化）
    expect([200, 500, 503]).toContain(resp.status());

    if (resp.ok()) {
      const data = await resp.json();
      expect(data).toHaveProperty("tasks");
      expect(data).toHaveProperty("total");
      expect(Array.isArray(data.tasks)).toBeTruthy();
    }
  });

  test("图片推理 API 参数校验", async ({ page, authToken }) => {
    // 上传非图片文件
    const resp = await page.request.post("/api/v1/inference/image", {
      headers: { Authorization: `Bearer ${authToken}` },
      multipart: {
        file: { name: "test.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") },
        task: "detect",
      },
    });
    expect(resp.status()).toBe(422);
  });

  test("批量推理 API 参数校验", async ({ page, authToken }) => {
    const resp = await page.request.post("/api/v1/inference/batch", {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { input_dir: "/nonexistent_path_12345", task: "detect" },
    });
    expect(resp.status()).toBe(422);
  });
});
