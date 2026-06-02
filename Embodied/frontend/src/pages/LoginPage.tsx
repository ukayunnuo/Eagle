import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { login as loginApi, getMe } from "../api/auth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const authLogin = useAuthStore((s) => s.login);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const tokens = await loginApi(username, password);
      authLogin({ id: 0, username, created_at: "" }, tokens.access_token, tokens.refresh_token);
      const user = await getMe();
      authLogin(user, tokens.access_token, tokens.refresh_token);
      navigate("/");
    } catch {
      setError("用户名或密码错误");
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
        <p className="text-sm text-slate-500 text-center mb-6">登录以继续</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:border-green-500 focus:outline-none"
              required
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
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <p className="text-sm text-slate-500 text-center mt-4">
          没有账号？{" "}
          <Link to="/register" className="text-green-400 hover:underline">
            注册
          </Link>
        </p>
      </div>
    </div>
  );
}
