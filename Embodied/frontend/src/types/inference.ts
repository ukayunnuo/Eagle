export interface Box {
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface InferenceResult {
  answer: string;
  boxes: Box[];
  annotated_image_url: string;
  stats: {
    decode_mode: string;
    tokens: number;
    time_ms: number;
  };
}

export interface TaskParams {
  task: string;
  phrase?: string;
  categories?: string;
  generation_mode?: 'fast' | 'slow' | 'hybrid';
  max_new_tokens?: number;
  max_image_edge?: number;
  temperature?: number;
  every_n_frames?: number;
  max_frames?: number;
  reuse_last?: boolean;
}

export interface Task {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  task_type: 'image' | 'video' | 'batch';
  params: TaskParams;
  progress?: {
    current_frame: number;
    total_frames: number;
  };
  result?: InferenceResult;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface InferenceStore {
  currentTask: Task | null;
  isProcessing: boolean;
  progress: number;
  result: InferenceResult | null;
  error: string | null;

  // Actions
  submitImageTask: (file: File, params: TaskParams) => Promise<void>;
  submitVideoTask: (file: File, params: TaskParams) => Promise<void>;
  submitBatchTask: (inputDir: string, params: TaskParams) => Promise<void>;
  pollTaskStatus: (taskId: string) => Promise<void>;
  clearResult: () => void;
  clearError: () => void;
}
