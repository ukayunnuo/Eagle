import api, { toBackendUrl } from './client';
import { Task, TaskParams } from '@/types/inference';

const INFERENCE_TIMEOUT_MS = 10 * 60 * 1000;

/** 后端 /inference/image 实际返回的扁平结构 */
interface ImageInferenceResponse {
  answer: string;
  boxes: Array<{ label: string; x1: number; y1: number; x2: number; y2: number }>;
  annotated_image_url: string;
  file_id: string;
}

const normalizeTask = (task: Task): Task => ({
  ...task,
  result: task.result
    ? {
        ...task.result,
        annotated_image_url: toBackendUrl(task.result.annotated_image_url),
      }
    : task.result,
});

export const inferenceApi = {
  submitImage: async (file: File, params: TaskParams): Promise<Task | ImageInferenceResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, String(value));
      }
    });

    const response = await api.post<ImageInferenceResponse>('/inference/image', formData, {
      timeout: INFERENCE_TIMEOUT_MS,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return {
      ...response.data,
      annotated_image_url: toBackendUrl(response.data.annotated_image_url),
    };
  },

  submitVideo: async (file: File, params: TaskParams): Promise<Task> => {
    const formData = new FormData();
    formData.append('file', file);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, String(value));
      }
    });

    const response = await api.post<Task>('/inference/video', formData, {
      timeout: INFERENCE_TIMEOUT_MS,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return normalizeTask(response.data);
  },

  submitBatch: async (inputDir: string, params: TaskParams): Promise<Task> => {
    const response = await api.post<Task>(
      '/inference/batch',
      {
        input_dir: inputDir,
        ...params,
      },
      {
        timeout: INFERENCE_TIMEOUT_MS,
      }
    );
    return normalizeTask(response.data);
  },

  getTask: async (taskId: string): Promise<Task> => {
    const response = await api.get<Task>(`/tasks/${taskId}`);
    return normalizeTask(response.data);
  },
};
