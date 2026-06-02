# LocateAnything Web 服务设计文档

> **日期：** 2026-06-02
> **状态：** 已批准
> **方案：** 单体 FastAPI + React SPA（方案 A）

---

## 1. 目标

将 LocateAnything 项目提供为完整的 Web 服务，包含：

- **Web UI**：用户可通过浏览器上传图片/视频，选择模型和任务类型，查看标注结果
- **REST API**：标准化的 API 接口，方便程序化调用和集成
- **用户系统**：注册/登录，JWT 认证，任务隔离
- **异步任务**：视频/批量推理通过异步队列处理，避免请求超时

---

## 2. 项目结构

在现有项目根目录下新增 `server/` 和 `frontend/` 目录，不侵入已有代码：

```
Embodied/
├── eaglevl/                  # (已有) 模型定义
├── scripts/                  # (已有) CLI 脚本 + Streamlit UI
├── eagle_worker.py           # (已有) 统一推理 Worker
├── locateanything_worker.py  # (已有) 旧版 Worker
│
├── server/                   # 新增：Web 服务
│   ├── __init__.py
│   ├── main.py               # FastAPI app 入口 + 挂载 React 静态文件
│   ├── config.py             # 环境变量 / 启动参数
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── models.py         # User SQLAlchemy 模型
│   │   ├── schemas.py        # Pydantic 请求/响应模型
│   │   ├── service.py        # 注册、登录、密码哈希、JWT 签发/验证
│   │   └── deps.py           # FastAPI Depends（get_current_user）
│   ├── api/
│   │   ├── __init__.py
│   │   ├── router.py         # 总路由
│   │   ├── auth_router.py    # 认证接口
│   │   ├── inference_router.py  # 推理接口
│   │   ├── task_router.py    # 任务管理接口
│   │   └── model_router.py   # 模型信息接口
│   ├── tasks/
│   │   ├── __init__.py
│   │   ├── manager.py        # AsyncTaskManager
│   │   └── schemas.py        # 任务状态 Pydantic 模型
│   ├── db.py                 # SQLAlchemy engine + session
│   └── static/               # React 构建产物
│
├── frontend/                 # 新增：React 前端
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/              # axios 封装 + 类型定义
│       ├── pages/            # Login, Dashboard, Inference, TaskHistory
│       ├── components/       # ImageUpload, VideoUpload, TaskCard, ResultViewer
│       └── stores/           # zustand 状态管理
│
└── tests/
    ├── conftest.py           # 共享 fixture
    ├── test_auth.py
    ├── test_inference.py
    ├── test_tasks.py
    └── test_models.py
```

**设计原则：**
- `server/` 独立目录，不修改现有 `scripts/` 或 `eagle_worker.py`
- 复用现有 `EagleWorker` 作为推理后端
- React 前端构建产物嵌入 `server/static/`，单进程部署

---

## 3. API 接口设计

### 3.1 认证接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/v1/auth/register` | 注册 | 无 |
| POST | `/api/v1/auth/login` | 登录，返回 access_token + refresh_token | 无 |
| POST | `/api/v1/auth/refresh` | 刷新 access_token | refresh_token |
| GET | `/api/v1/auth/me` | 获取当前用户信息 | access_token |

**请求/响应示例：**

```json
// POST /api/v1/auth/register
// 请求
{ "username": "alice", "password": "s3cret" }
// 响应 201
{ "id": 1, "username": "alice", "created_at": "2026-06-02T10:00:00Z" }

// POST /api/v1/auth/login
// 请求
{ "username": "alice", "password": "s3cret" }
// 响应 200
{ "access_token": "eyJ...", "refresh_token": "eyJ...", "token_type": "bearer", "expires_in": 3600 }
```

### 3.2 模型信息接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/v1/models` | 列出当前模型信息和支持的任务 | access_token |

```json
// 响应 200
{
  "current_model": "nvidia/LocateAnything-3B",
  "family": "locateanything",
  "device": "cuda",
  "dtype": "bfloat16",
  "supported_tasks": ["detect", "ground_multi", "detect_text", "point", "ground_gui", "chat"],
  "supports_generation_mode": true
}
```

### 3.3 推理接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/v1/inference/image` | 图片推理（同步返回） | access_token |
| POST | `/api/v1/inference/video` | 视频推理（异步，返回 task_id） | access_token |
| POST | `/api/v1/inference/batch` | 批量推理（异步，返回 task_id） | access_token |

> **批量推理说明：** 接受 JSON 请求体，包含服务器本地目录路径（`input_dir`）和推理参数。适用于服务器本地已有大量文件的场景。如需上传多文件批量处理，可多次调用 `/api/v1/inference/image` 或 `/api/v1/inference/video`。

```json
// POST /api/v1/inference/image
// 请求：multipart/form-data
//   file: 图片文件
//   task: "ground_multi"
//   phrase: "猫"
//   generation_mode: "hybrid"
//   max_new_tokens: 128
//   max_image_edge: 768
//   temperature: 0.7
// 响应 200
{
  "answer": "<ref>猫</ref><box><100><200><300><400></box>",
  "boxes": [{"label": "猫", "x1": 100, "y1": 200, "x2": 300, "y2": 400}],
  "annotated_image_url": "/api/v1/files/abc123.jpg",
  "stats": { "decode_mode": "fast", "tokens": 12, "time_ms": 45.2 }
}

// POST /api/v1/inference/video
// 请求：multipart/form-data
//   file: 视频文件
//   task, phrase, ... 同上
//   every_n_frames: 10
//   max_frames: 0
//   reuse_last: true
// 响应 202
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "视频标注任务已提交"
}
```

### 3.4 任务管理接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/v1/tasks` | 列出当前用户的任务（分页） | access_token |
| GET | `/api/v1/tasks/{task_id}` | 查询单个任务状态和结果 | access_token |
| DELETE | `/api/v1/tasks/{task_id}` | 取消/删除任务 | access_token |

> **结果获取：** 任务完成后，结果通过 `GET /api/v1/tasks/{task_id}` 响应中的 `result.output_video_url` / `result.output_json_url` / `result.annotated_image_url` 字段获取，统一走 `GET /api/v1/files/{file_id}` 下载。

```json
// GET /api/v1/tasks/{task_id}
// 响应（处理中）
{
  "task_id": "550e8400-...",
  "status": "processing",
  "progress": { "current_frame": 30, "total_frames": 100 },
  "created_at": "2026-06-02T10:00:00Z"
}
// 响应（完成）
{
  "task_id": "550e8400-...",
  "status": "completed",
  "result": {
    "output_video_url": "/api/v1/files/xyz789.mp4",
    "output_json_url": "/api/v1/files/xyz789.json",
    "processed_frames": 100,
    "summary": { "total_detections": 42 }
  },
  "created_at": "...",
  "completed_at": "..."
}
```

### 3.5 文件下载接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/v1/files/{file_id}` | 下载标注结果文件 | access_token |

---

## 4. 异步任务系统

### 4.1 任务状态流转

```
pending → processing → completed
                    → failed
                    → cancelled
```

### 4.2 AsyncTaskManager

```python
class AsyncTaskManager:
    """内存任务队列 + 后台 worker 协程"""

    def submit(user_id, task_type, params, file_path) -> str:
        """提交任务，返回 task_id（UUID）"""

    def get_status(task_id) -> TaskStatus:
        """查询任务状态"""

    def cancel(task_id) -> bool:
        """取消任务（仅 pending 状态可取消）"""

    def list_user_tasks(user_id, page, size) -> list[TaskStatus]:
        """列出用户的任务"""
```

**运行机制：**
- 启动时创建 1 个后台 `asyncio` worker 协程（单 GPU 串行处理）
- 任务提交后进入 `pending` 队列
- Worker 从队列取任务，调用 `EagleWorker` 执行推理
- 任务完成后更新状态，结果文件写入 `output/` 目录
- 任务元数据持久化到 SQLite

**文件存储：**
```
output/
├── {task_id}/
│   ├── annotated.jpg          # 图片标注结果
│   ├── annotated.mp4          # 视频标注结果
│   ├── result.json            # 结构化结果
│   └── input.mp4              # 原始上传文件
```

**并发控制：**
- 同一时间只运行一个推理任务，其余排队
- 通过 `asyncio.Lock` 保证 GPU 互斥访问
- 前端显示队列位置

---

## 5. 认证与数据库

### 5.1 数据库模型（SQLite + SQLAlchemy）

```sql
-- users 表
CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(128) NOT NULL,       -- bcrypt 哈希
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- tasks 表
CREATE TABLE tasks (
    id            VARCHAR(36) PRIMARY KEY,     -- UUID
    user_id       INTEGER NOT NULL REFERENCES users(id),
    task_type     VARCHAR(20) NOT NULL,        -- image / video / batch
    status        VARCHAR(20) NOT NULL,        -- pending / processing / completed / failed / cancelled
    params        TEXT NOT NULL,               -- JSON：任务参数
    input_path    VARCHAR(500),
    output_dir    VARCHAR(500),
    progress      TEXT,                        -- JSON：进度信息
    result        TEXT,                        -- JSON：结果摘要
    error         TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at    DATETIME,
    completed_at  DATETIME
);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
```

### 5.2 JWT 认证流程

1. 注册 → 密码 bcrypt 哈希 → 存入 users 表
2. 登录 → 验证密码 → 签发双 token：
   - `access_token`：有效期 1 小时
   - `refresh_token`：有效期 7 天
3. API 请求 → `Authorization: Bearer <access_token>` → 解码验证 → 获取 user_id
4. token 过期 → POST `/api/v1/auth/refresh` → 签发新 access_token

**安全设计：**
- 密码用 bcrypt 哈希存储，永不存明文
- JWT secret key 通过环境变量 `JWT_SECRET` 配置
- 前端 token 存 localStorage
- 用户只能访问自己的任务和文件

---

## 6. 前端设计

### 6.1 技术栈

```
React 18 + TypeScript + Vite
├── UI: shadcn/ui + Tailwind CSS（暗色科技风格）
├── 状态管理: zustand
├── 路由: React Router v6
├── HTTP: axios（拦截器处理 token 刷新）
└── 表单: React Hook Form + Zod
```

### 6.2 页面结构

```
/login          → 登录页
/register       → 注册页
/               → 仪表盘（模型状态 + 最近任务 + 快速入口）
/inference      → 推理工作台（核心页面）
  ├─ 图片标签页   → 上传 → 选任务 → 配置 → 提交 → 查看结果
  ├─ 视频标签页   → 上传 → 配置 → 提交 → 轮询进度 → 查看结果
  └─ 批量标签页   → 填目录 → 配置 → 提交 → 轮询进度
/tasks          → 任务历史列表（分页，按状态筛选）
/tasks/:id      → 任务详情
```

### 6.3 推理工作台布局

```
┌─────────────────────────────────────────────────┐
│  [图片] [视频] [批量]                             │
├─────────────────────────────────────────────────┤
│  ┌── 左侧面板 ──────────┐  ┌── 右侧结果 ──────┐ │
│  │ 📤 拖拽上传区域       │  │  标注后图片/视频   │ │
│  │                       │  │  （带 bbox 绘制）  │ │
│  │ 任务类型: [ground ▾] │  │                   │ │
│  │ 描述短语: [猫      ] │  │  ── 结构化结果 ── │ │
│  │ 生成模式: [hybrid ▾] │  │  boxes: [...]     │ │
│  │ max_tokens: [128   ] │  │  answer: "..."    │ │
│  │ temperature: [0.7  ] │  │                   │ │
│  │                       │  │  [📥 下载图片]    │ │
│  │ [▶ 开始推理]          │  │  [📥 下载 JSON]   │ │
│  └───────────────────────┘  └───────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 6.4 关键交互

- **图片推理**：提交后 spinner 等待，结果直接渲染（同步，< 1秒）
- **视频推理**：提交后显示进度条，轮询 `/api/v1/tasks/{id}` 更新
- **任务历史**：卡片列表，状态标签（pending 蓝 / processing 黄 / completed 绿 / failed 红）
- **Token 刷新**：axios 拦截器捕获 401 → 自动 refresh → 重放原请求
- **暗色主题**：`#0F172A` 背景 + `#22C55E` 绿色强调

### 6.5 构建与嵌入

```bash
# 开发模式
cd frontend && npm run dev          # Vite dev server :5173
python -m server.main               # FastAPI :8000

# 生产构建
cd frontend && npm run build
cp -r frontend/dist/* server/static/
python -m server.main               # 单进程，/ 挂载静态文件
```

---

## 7. 错误处理

### 7.1 API 统一错误格式

```json
{
  "detail": "错误描述",
  "error_code": "INVALID_TASK_TYPE",
  "status_code": 422
}
```

### 7.2 关键错误场景

| 场景 | HTTP 状态码 | 处理方式 |
|------|------------|---------|
| 未认证 / token 过期 | 401 | 返回错误，前端自动 refresh |
| 无权限访问他人任务 | 403 | 直接拒绝 |
| 文件格式不支持 | 422 | 参数校验阶段拦截 |
| 文件过大 | 413 | 中间件限制（图片 20MB / 视频 500MB） |
| GPU 推理失败 | 500 | 任务标记 failed，记录 error |
| 队列积压过多 | 503 | 拒绝新任务，提示稍后重试 |

### 7.3 前端错误处理

- axios 拦截器统一捕获非 2xx 响应，toast 提示
- 网络断开时显示连接状态指示

---

## 8. 测试策略

### 8.1 测试文件

```
tests/
├── conftest.py              # 测试 DB、mock Worker、测试用户 fixture
├── test_auth.py             # 注册、登录、token 刷新、权限
├── test_inference.py        # 图片推理（mock）、视频提交、参数校验
├── test_tasks.py            # 查询、取消、结果下载
└── test_models.py           # 模型信息接口
```

### 8.2 测试方案

- `httpx.AsyncClient` + FastAPI `TestClient` 做 API 集成测试
- `EagleWorker` 在测试中 mock，返回固定结果
- SQLite 用内存数据库，每个测试独立
- 覆盖率目标 >= 80%

---

## 9. 启动与配置

### 9.1 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MODEL_PATH` | `nvidia/LocateAnything-3B` | 模型路径或 HuggingFace ID |
| `DEVICE` | `cuda` | 计算设备 |
| `DTYPE` | `bfloat16` | 推理精度 |
| `JWT_SECRET` | （必填） | JWT 签名密钥 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | access_token 有效期 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | refresh_token 有效期 |
| `DB_URL` | `sqlite:///./data/app.db` | 数据库连接串 |
| `MAX_UPLOAD_IMAGE_MB` | `20` | 图片上传限制 |
| `MAX_UPLOAD_VIDEO_MB` | `500` | 视频上传限制 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `PORT` | `8000` | 监听端口 |

### 9.2 启动命令

```bash
export JWT_SECRET=your-secret-key
export MODEL_PATH=nvidia/LocateAnything-3B

python -m server.main
# 或
uvicorn server.main:app --host 0.0.0.0 --port 8000
```

---

## 10. 实施阶段

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| P1 | FastAPI 骨架 + 认证 + 图片推理 API | 核心 |
| P2 | 异步任务系统 + 视频/批量推理 API | 核心 |
| P3 | React 前端（推理工作台 + 任务历史） | 主要 |
| P4 | 测试 + 文档 + 打包部署 | 收尾 |
