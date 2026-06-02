import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../api/auth";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(username, password);
      navigate("/login");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "注册失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm p-8 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl">
        <h1 className="text-2xl font-bold text-center mb-1">
          🎯 <span className="text-green-400">LocateAnything</span>
        </h1>
        <p className="text-sm text-slate-500 text-center mb-6">创建新账号</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:border-green-500 focus:outline-none"
              required
              minLength={3}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:border-green-500 focus:outline-none"
              required
              minLength={6}
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? "注册中..." : "注册"}
          </button>
        </form>

        <p className="text-sm text-slate-500 text-center mt-4">
          已有账号？{" "}
          <Link to="/login" className="text-green-400 hover:underline">
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
