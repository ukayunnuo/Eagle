import client from "./client";
import type { ImageInferenceResult, ModelInfo } from "./types";

export async function getModelInfo(): Promise<ModelInfo> {
  const { data } = await client.get("/models");
  return data;
}

export async function imageInference(
  file: File,
  params: {
    task: string;
    phrase?: string;
    categories?: string;
    question?: string;
    generation_mode?: string;
    max_new_tokens?: number;
    max_image_edge?: number;
    temperature?: number;
  },
): Promise<ImageInferenceResult> {
  const form = new FormData();
  form.append("file", file);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) form.append(k, String(v));
  });
  const { data } = await client.post("/inference/image", form);
  return data;
}

export async function videoInference(
  file: File,
  params: Record<string, string | number | boolean>,
): Promise<{ task_id: string; status: string }> {
  const form = new FormData();
  form.append("file", file);
  Object.entries(params).forEach(([k, v]) => form.append(k, String(v)));
  const { data } = await client.post("/inference/video", form);
  return data;
}

export async function batchInference(
  params: Record<string, string | number | boolean>,
): Promise<{ task_id: string; status: string }> {
  const { data } = await client.post("/inference/batch", params);
  return data;
}
