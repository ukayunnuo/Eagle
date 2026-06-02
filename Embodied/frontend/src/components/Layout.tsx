import { NavLink, Outlet } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { LayoutDashboard, Scan, ListTodo, LogOut } from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "仪表盘" },
  { to: "/inference", icon: Scan, label: "推理工作台" },
  { to: "/tasks", icon: ListTodo, label: "任务历史" },
];

export default function Layout() {
  const { user, logout } = useAuthStore();

  return (
    <div className="flex h-screen">
      {/* 侧边栏 */}
      <aside className="w-60 shrink-0 border-r border-slate-800 bg-slate-950 flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <h1 className="text-lg font-bold">
            🎯 <span className="text-green-400">LocateAnything</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Visual Grounding Service</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-green-500/10 text-green-400"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400 truncate">{user?.username}</span>
            <button
              onClick={logout}
              className="text-slate-500 hover:text-red-400 transition-colors"
              title="退出登录"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
