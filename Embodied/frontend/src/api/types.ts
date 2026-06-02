// API 类型定义

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface ModelInfo {
  current_model: string;
  family: string;
  device: string;
  dtype: string;
  supported_tasks: string[];
  supports_generation_mode: boolean;
}

export interface BoxAnnotation {
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ImageInferenceResult {
  answer: string;
  boxes: BoxAnnotation[];
  annotated_image_url: string;
  file_id: string;
}

export interface TaskStatus {
  task_id: string;
  task_type: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress: { current_frame?: number; total_frames?: number } | null;
  result: {
    output_video_url?: string;
    output_json_url?: string;
    annotated_image_url?: string;
    processed_frames?: number;
  } | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface TaskListResponse {
  tasks: TaskStatus[];
  total: number;
  page: number;
  size: number;
}
