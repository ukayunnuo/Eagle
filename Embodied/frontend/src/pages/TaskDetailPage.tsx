import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getTask } from "../api/tasks";
import { ArrowLeft, Download } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-blue-500/20 text-blue-400",
  processing: "bg-yellow-500/20 text-yellow-400",
  completed: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  cancelled: "bg-slate-500/20 text-slate-400",
};

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { data: task, isLoading } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask(taskId!),
    enabled: !!taskId,
    refetchInterval: (q) =>
      q.state.data?.status === "processing" || q.state.data?.status === "pending" ? 2000 : false,
  });

  if (isLoading) return <p className="text-slate-500">加载中...</p>;
  if (!task) return <p className="text-red-400">任务不存在</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/tasks" className="text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-2xl font-bold">任务详情</h2>
        <span className={`px-2.5 py-1 rounded text-xs font-medium ${statusColors[task.status]}`}>
          {task.status}
        </span>
      </div>

      {/* 基本信息 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500 mb-1">任务 ID</p>
          <p className="text-sm font-mono text-slate-300">{task.task_id}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500 mb-1">类型</p>
          <p className="text-sm text-slate-300">{task.task_type}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500 mb-1">创建时间</p>
          <p className="text-sm text-slate-300">
            {task.created_at ? new Date(task.created_at).toLocaleString("zh-CN") : "—"}
          </p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500 mb-1">完成时间</p>
          <p className="text-sm text-slate-300">
            {task.completed_at ? new Date(task.completed_at).toLocaleString("zh-CN") : "—"}
          </p>
        </div>
      </div>

      {/* 进度 */}
      {(task.status === "processing" || task.status === "pending") && task.progress && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500 mb-2">进度</p>
          <div className="w-full bg-slate-800 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{
                width: `${task.progress.total_frames ? (task.progress.current_frame! / task.progress.total_frames) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {task.progress.current_frame || 0} / {task.progress.total_frames || "?"} 帧
          </p>
        </div>
      )}

      {/* 错误 */}
      {task.error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-xs text-red-400 mb-1">错误信息</p>
          <pre className="text-sm text-red-300 whitespace-pre-wrap font-mono">{task.error}</pre>
        </div>
      )}

      {/* 结果 */}
      {task.result && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <p className="text-sm font-semibold text-slate-400">结果</p>
          {task.result.output_video_url && (
            <div>
              <video
                src={task.result.output_video_url}
                controls
                className="w-full rounded-lg"
              />
              <a
                href={task.result.output_video_url}
                download
                className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 border border-green-500 text-green-400 rounded-lg text-sm hover:bg-green-500/10 transition-colors"
              >
                <Download size={14} /> 下载视频
              </a>
            </div>
          )}
          {task.result.annotated_image_url && (
            <img src={task.result.annotated_image_url} alt="结果" className="w-full rounded-lg" />
          )}
          {task.result.output_json_url && (
            <a
              href={task.result.output_json_url}
              download
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-green-500 text-green-400 rounded-lg text-sm hover:bg-green-500/10 transition-colors"
            >
              <Download size={14} /> 下载 JSON
            </a>
          )}
        </div>
      )}
    </div>
  );
}
