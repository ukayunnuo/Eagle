import { NavLink, Outlet } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { LayoutDashboard, Scan, ListTodo, LogOut } from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "仪表盘" },
  { to: "/inference", icon: Scan, label: "推理工作台" },
  { to: "/tasks", icon: ListTodo, label: "任务历史" },
];

export default function Layout() {
  const { logout } = useAuthStore();

  return (
    <div className="flex flex-col lg:flex-row h-screen">
      {/* 侧边栏 */}
      <aside className="w-full lg:w-60 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible">
        <div className="p-4 lg:p-5 border-r lg:border-r-0 lg:border-b border-slate-800 shrink-0">
          <h1 className="text-lg font-bold whitespace-nowrap">
            🎯 <span className="text-green-400">LocateAnything</span>
          </h1>
        </div>

        <nav className="flex-1 flex lg:flex-col p-2 lg:p-3 gap-1 overflow-x-auto lg:overflow-x-visible">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2 lg:gap-3 px-3 py-2 lg:py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-green-500/10 text-green-400"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`
              }
            >
              <Icon size={18} />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 lg:p-4 border-l lg:border-l-0 lg:border-t border-slate-800 flex items-center shrink-0">
          <button
            onClick={logout}
            className="text-slate-500 hover:text-red-400 transition-colors"
            title="退出登录"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}
