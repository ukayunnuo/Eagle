import api from './client';
import { Task } from '@/types/inference';

export interface TaskListParams {
  page?: number;
  size?: number;
  status?: string;
}

export interface TaskListResponse {
  items: Task[];
  total: number;
  page: number;
  size: number;
}

interface ApiTaskListResponse {
  tasks?: Task[];
  items?: Task[];
  total: number;
  page: number;
  size: number;
}

export const tasksApi = {
  list: async (params?: TaskListParams): Promise<TaskListResponse> => {
    const response = await api.get<ApiTaskListResponse>('/tasks', { params });
    const { tasks, items, ...rest } = response.data;
    return {
      ...rest,
      items: items ?? tasks ?? [],
    };
  },

  get: async (taskId: string): Promise<Task> => {
    const response = await api.get<Task>(`/tasks/${taskId}`);
    return response.data;
  },

  delete: async (taskId: string): Promise<void> => {
    await api.delete(`/tasks/${taskId}`);
  },
};
