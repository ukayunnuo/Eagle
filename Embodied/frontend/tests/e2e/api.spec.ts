import { test, expect } from "./fixtures";

const API_BASE = "http://127.0.0.1:8000/api/v1";

test.describe("API 接口", () => {
  test("未认证访问 API 返回 401", async ({ page }) => {
    const resp = await page.request.get(`${API_BASE}/tasks?page=1&size=5`);
    expect(resp.status()).toBeGreaterThanOrEqual(401);
  });

  test("任务列表接口返回正确结构", async ({ page, authToken }) => {
    const resp = await page.request.get(`${API_BASE}/tasks?page=1&size=5`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty("tasks");
    expect(data).toHaveProperty("total");
    expect(Array.isArray(data.tasks)).toBeTruthy();
  });

  test("图片推理 API 参数校验", async ({ page, authToken }) => {
    const resp = await page.request.post(`${API_BASE}/inference/image`, {
      headers: { Authorization: `Bearer ${authToken}` },
      multipart: {
        file: { name: "test.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") },
        task: "detect",
        phrase: "person",
        categories: "person",
        question: "test",
        generation_mode: "hybrid",
        max_new_tokens: "128",
        max_image_edge: "768",
        temperature: "0.7",
      },
    });
    expect(resp.status()).toBe(422);
  });

  test("批量推理 API 参数校验", async ({ page, authToken }) => {
    const resp = await page.request.post(`${API_BASE}/inference/batch`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { input_dir: "/nonexistent_path_12345", task: "detect" },
    });
    expect(resp.status()).toBe(422);
  });
});
