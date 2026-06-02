import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listTasks } from "../api/tasks";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TaskStatus } from "../api/types";

const statusColors: Record<string, string> = {
  pending: "bg-blue-500/20 text-blue-400",
  processing: "bg-yellow-500/20 text-yellow-400",
  completed: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  cancelled: "bg-slate-500/20 text-slate-400",
};

export default function TasksPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const size = 10;

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", page, size, statusFilter],
    queryFn: () => listTasks(page, size, statusFilter || undefined),
  });

  const totalPages = Math.ceil((data?.total || 0) / size);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">任务历史</h2>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300"
        >
          <option value="">全部状态</option>
          <option value="pending">排队中</option>
          <option value="processing">处理中</option>
          <option value="completed">已完成</option>
          <option value="failed">失败</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-slate-500">加载中...</p>
      ) : data?.tasks.length === 0 ? (
        <p className="text-slate-500">暂无任务</p>
      ) : (
        <div className="space-y-2">
          {data?.tasks.map((t: TaskStatus) => (
            <Link
              key={t.task_id}
              to={`/tasks/${t.task_id}`}
              className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className={`px-2.5 py-1 rounded text-xs font-medium ${statusColors[t.status]}`}>
                  {t.status}
                </span>
                <span className="text-sm text-slate-300">{t.task_type}</span>
                <span className="text-xs text-slate-600 font-mono">{t.task_id.slice(0, 8)}...</span>
              </div>
              <span className="text-xs text-slate-600">
                {t.created_at ? new Date(t.created_at).toLocaleString("zh-CN") : ""}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1.5 rounded border border-slate-700 disabled:opacity-30 text-slate-400"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-1.5 rounded border border-slate-700 disabled:opacity-30 text-slate-400"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
