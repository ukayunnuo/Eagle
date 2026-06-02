import client from "./client";
import type { TaskListResponse, TaskStatus } from "./types";

export async function listTasks(
  page = 1,
  size = 20,
  status?: string,
): Promise<TaskListResponse> {
  const params: Record<string, string | number> = { page, size };
  if (status) params.status = status;
  const { data } = await client.get("/tasks", { params });
  return data;
}

export async function getTask(taskId: string): Promise<TaskStatus> {
  const { data } = await client.get(`/tasks/${taskId}`);
  return data;
}

export async function cancelTask(taskId: string): Promise<void> {
  await client.delete(`/tasks/${taskId}`);
}
