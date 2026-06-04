# LocateAnything Web 服务

基于 Next.js + Ant Design 的视觉定位与目标检测 Web 平台。

## 快速开始

### 方式一：一键启动（Windows）

双击运行 `start_dev.bat`

### 方式二：手动启动

**启动后端：**
```bash
cd E:/pythonSpace/Eagle/Embodied
python -m server.main
```

**启动前端：**
```bash
cd E:/pythonSpace/Eagle/Embodied/frontend
npm run dev
```

### 访问地址

- **前端**: http://localhost:3000
- **后端 API**: http://localhost:8000
- **API 文档**: http://localhost:8000/docs

## 功能特性

### 1. 用户系统
- 用户注册/登录
- JWT Token 认证
- 自动 Token 刷新

### 2. 推理工作台
- **图片推理**：支持目标检测、短语定位、文本检测、点定位、GUI定位
- **视频推理**：支持视频上传和逐帧推理
- **批量推理**：支持服务器本地目录批量处理

### 3. 任务管理
- 任务列表（分页、筛选）
- 任务详情查看
- 任务删除
- 实时状态更新

### 4. 用户设置
- 默认推理参数配置
- 密码修改
- 账号管理

### 5. 仪表盘
- 任务统计
- 快速入口
- 最近任务

## 技术栈

### 前端
- **框架**: Next.js 14 (App Router)
- **UI 库**: Ant Design 5.x
- **状态管理**: Zustand
- **HTTP 客户端**: Axios
- **语言**: TypeScript

### 后端
- **框架**: FastAPI
- **数据库**: SQLite
- **认证**: JWT
- **推理引擎**: EagleWorker (PyTorch)

## 项目结构

```
Embodied/
├── frontend/              # Next.js 前端
│   ├── src/
│   │   ├── app/          # 页面路由
│   │   ├── components/   # 可复用组件
│   │   ├── lib/          # 工具函数和 API
│   │   ├── stores/       # Zustand 状态管理
│   │   ├── theme/        # 主题配置
│   │   └── types/        # TypeScript 类型
│   └── package.json
│
├── server/                # FastAPI 后端
│   ├── api/              # API 路由
│   ├── auth/             # 认证模块
│   ├── tasks/            # 任务管理
│   ├── static/           # 前端构建产物
│   └── main.py           # 应用入口
│
├── eagle_worker.py        # 推理 Worker
└── start_dev.bat          # 启动脚本
```

## API 接口

### 认证
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/refresh` - Token 刷新
- `GET /api/v1/auth/me` - 获取用户信息

### 推理
- `POST /api/v1/inference/image` - 图片推理
- `POST /api/v1/inference/video` - 视频推理
- `POST /api/v1/inference/batch` - 批量推理

### 任务
- `GET /api/v1/tasks` - 任务列表
- `GET /api/v1/tasks/{id}` - 任务详情
- `DELETE /api/v1/tasks/{id}` - 删除任务

### 文件
- `GET /api/v1/files/{id}` - 文件下载

## 开发说明

### 前端开发
```bash
cd frontend
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run lint     # 代码检查
```

### 后端开发
```bash
python -m server.main    # 启动后端服务
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MODEL_PATH` | `nvidia/LocateAnything-3B` | 模型路径 |
| `DEVICE` | `cuda` | 计算设备 |
| `DTYPE` | `bfloat16` | 推理精度 |
| `JWT_SECRET` | `your-secret-key` | JWT 密钥 |
| `DB_URL` | `sqlite:///./data/app.db` | 数据库路径 |

## 常见问题

### 1. 前端无法连接后端
确保后端服务已启动，并且 CORS 配置正确。

### 2. 推理失败
检查 GPU 是否可用，模型是否正确加载。

### 3. 构建失败
确保 Node.js 版本 >= 18，npm 版本 >= 9。

## 许可证

MIT License
