# LocateAnything Web 服务

基于 FastAPI + React 的视觉定位与目标检测 Web 服务。

## 快速启动

### 1. 安装依赖

```bash
pip install -e .
cd frontend && npm install && npm run build
```

### 2. 配置环境变量

```bash
export JWT_SECRET=your-secret-key-here
export MODEL_PATH=nvidia/LocateAnything-3B  # 可选，默认值
export DEVICE=cuda                           # 可选，默认 cuda
export DTYPE=bfloat16                        # 可选，默认 bfloat16
```

或创建 `.env` 文件：

```
JWT_SECRET=your-secret-key-here
MODEL_PATH=nvidia/LocateAnything-3B
DEVICE=cuda
DTYPE=bfloat16
```

### 3. 启动服务

```bash
python -m server.main
```

访问 `http://localhost:8000` 打开 Web UI，访问 `http://localhost:8000/docs` 查看 API 文档。

## API 概览

所有 API 以 `/api/v1` 为前缀，需要 JWT 认证（`Authorization: Bearer <token>`）。

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/register` | 注册 |
| POST | `/api/v1/auth/login` | 登录 |
| POST | `/api/v1/auth/refresh` | 刷新 token |
| GET | `/api/v1/auth/me` | 获取当前用户 |

### 推理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/inference/image` | 图片推理（同步） |
| POST | `/api/v1/inference/video` | 视频推理（异步） |
| POST | `/api/v1/inference/batch` | 批量推理（异步） |

### 任务管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/tasks` | 任务列表 |
| GET | `/api/v1/tasks/{id}` | 任务详情 |
| DELETE | `/api/v1/tasks/{id}` | 取消任务 |

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/models` | 模型信息 |
| GET | `/api/v1/files/{id}/{name}` | 下载文件 |

## 配置参考

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MODEL_PATH` | `nvidia/LocateAnything-3B` | 模型路径 |
| `DEVICE` | `cuda` | 计算设备 |
| `DTYPE` | `bfloat16` | 推理精度 |
| `JWT_SECRET` | （必填） | JWT 签名密钥 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | token 有效期 |
| `DB_URL` | `sqlite+aiosqlite:///./data/app.db` | 数据库 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `PORT` | `8000` | 监听端口 |

## 开发模式

```bash
# 终端 1：后端
python -m server.main

# 终端 2：前端（热更新）
cd frontend && npm run dev
```

前端 Vite 开发服务器（端口 5173）会自动代理 `/api` 请求到后端（端口 8000）。

## 架构

```
┌─────────────────────────────────────┐
│          FastAPI (单进程)             │
│  ┌───────────┐  ┌────────────────┐  │
│  │ REST API  │  │ JWT Auth       │  │
│  │ /api/v1/* │  │ SQLite         │  │
│  └─────┬─────┘  └────────────────┘  │
│  ┌─────┴─────┐                      │
│  │ Task Queue│  (asyncio 内存队列)    │
│  └─────┬─────┘                      │
│  ┌─────┴─────┐                      │
│  │EagleWorker│  (GPU 推理)           │
│  └───────────┘                      │
│  / (静态文件) → React SPA            │
└─────────────────────────────────────┘
```
