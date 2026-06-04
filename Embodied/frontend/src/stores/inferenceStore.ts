import { create } from 'zustand';
import { inferenceApi } from '@/lib/api/inference';
import { InferenceStore, InferenceResult, Task } from '@/types/inference';

export const useInferenceStore = create<InferenceStore>((set, get) => ({
  currentTask: null,
  isProcessing: false,
  progress: 0,
  result: null,
  error: null,

  submitImageTask: async (file: File, params) => {
    set({ isProcessing: true, error: null, result: null, progress: 0 });

    try {
      const response = await inferenceApi.submitImage(file, params);

      // 后端 /inference/image 同步返回扁平结构 { answer, boxes, annotated_image_url, file_id }
      // 用 'answer' in response 做类型收窄
      if ('answer' in response) {
        const result: InferenceResult = {
          answer: response.answer,
          boxes: response.boxes || [],
          annotated_image_url: response.annotated_image_url || '',
          stats: { decode_mode: '', tokens: 0, time_ms: 0 },
        };
        set({
          currentTask: { ...response, status: 'completed', result } as unknown as Task,
          result,
          isProcessing: false,
          progress: 100,
        });
      } else {
        // 回退：如果后端返回了 Task 结构（异步任务）
        const task = response as Task;
        set({ currentTask: task });
        if (task.status === 'completed' && task.result) {
          set({
            result: task.result,
            isProcessing: false,
            progress: 100,
          });
        } else if (task.status === 'failed') {
          set({
            error: task.error || '推理失败',
            isProcessing: false,
          });
        }
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      set({
        error: axiosError.response?.data?.detail || '提交任务失败',
        isProcessing: false,
      });
    }
  },

  submitVideoTask: async (file: File, params) => {
    set({ isProcessing: true, error: null, result: null, progress: 0 });

    try {
      const task = await inferenceApi.submitVideo(file, params);
      set({ currentTask: task });

      // 视频推理是异步的，开始轮询
      if (task.task_id) {
        get().pollTaskStatus(task.task_id);
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      set({
        error: axiosError.response?.data?.detail || '提交任务失败',
        isProcessing: false,
      });
    }
  },

  submitBatchTask: async (inputDir: string, params) => {
    set({ isProcessing: true, error: null, result: null, progress: 0 });

    try {
      const task = await inferenceApi.submitBatch(inputDir, params);
      set({ currentTask: task });

      // 批量推理是异步的，开始轮询
      if (task.task_id) {
        get().pollTaskStatus(task.task_id);
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      set({
        error: axiosError.response?.data?.detail || '提交任务失败',
        isProcessing: false,
      });
    }
  },

  pollTaskStatus: async (taskId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const task = await inferenceApi.getTask(taskId);
        set({ currentTask: task });

        if (task.progress) {
          const progress = Math.round(
            (task.progress.current_frame / task.progress.total_frames) * 100
          );
          set({ progress });
        }

        if (task.status === 'completed') {
          clearInterval(pollInterval);
          set({
            result: task.result || null,
            isProcessing: false,
            progress: 100,
          });
        } else if (task.status === 'failed') {
          clearInterval(pollInterval);
          set({
            error: task.error || '任务失败',
            isProcessing: false,
          });
        } else if (task.status === 'cancelled') {
          clearInterval(pollInterval);
          set({
            error: '任务已取消',
            isProcessing: false,
          });
        }
      } catch (error) {
        clearInterval(pollInterval);
        set({
          error: '获取任务状态失败',
          isProcessing: false,
        });
      }
    }, 1000); // 每秒轮询一次
  },

  clearResult: () => {
    set({
      currentTask: null,
      result: null,
      progress: 0,
      error: null,
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));
