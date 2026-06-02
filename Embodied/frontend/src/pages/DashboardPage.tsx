import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getModelInfo } from "../api/inference";
import { listTasks } from "../api/tasks";
import { Cpu, Zap, ArrowRight } from "lucide-react";
import type { TaskStatus } from "../api/types";

const statusColors: Record<string, string> = {
  pending: "bg-blue-500/20 text-blue-400",
  processing: "bg-yellow-500/20 text-yellow-400",
  completed: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  cancelled: "bg-slate-500/20 text-slate-400",
};

export default function DashboardPage() {
  const model = useQuery({ queryKey: ["model"], queryFn: getModelInfo });
  const tasks = useQuery({ queryKey: ["tasks", 1, 5], queryFn: () => listTasks(1, 5) });

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="text-2xl font-bold">仪表盘</h2>

      {/* 模型状态 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-2 text-slate-500 text-xs uppercase mb-2">
            <Cpu size={14} /> 模型
          </div>
          <div className="text-lg font-semibold font-mono">
            {model.data?.current_model?.split("/").pop() || "加载中..."}
          </div>
        </div>
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-2 text-slate-500 text-xs uppercase mb-2">
            <Zap size={14} /> 设备
          </div>
          <div className="text-lg font-semibold text-green-400 font-mono">
            {model.data?.device?.toUpperCase() || "—"}
          </div>
        </div>
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-slate-500 text-xs uppercase mb-2">精度</div>
          <div className="text-lg font-semibold font-mono">{model.data?.dtype || "—"}</div>
        </div>
      </div>

      {/* 快速入口 */}
      <div className="flex gap-3">
        <Link
          to="/inference"
          className="flex items-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-colors"
        >
          开始推理 <ArrowRight size={16} />
        </Link>
        <Link
          to="/tasks"
          className="flex items-center gap-2 px-5 py-3 border border-slate-700 hover:border-slate-600 text-slate-300 rounded-xl transition-colors"
        >
          查看任务历史
        </Link>
      </div>

      {/* 最近任务 */}
      <div>
        <h3 className="text-lg font-semibold mb-3">最近任务</h3>
        {tasks.data?.tasks.length === 0 ? (
          <p className="text-slate-500 text-sm">暂无任务</p>
        ) : (
          <div className="space-y-2">
            {tasks.data?.tasks.map((t: TaskStatus) => (
              <Link
                key={t.task_id}
                to={`/tasks/${t.task_id}`}
                className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[t.status]}`}>
                    {t.status}
                  </span>
                  <span className="text-sm text-slate-400">{t.task_type}</span>
                </div>
                <span className="text-xs text-slate-600 font-mono">{t.task_id.slice(0, 8)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
