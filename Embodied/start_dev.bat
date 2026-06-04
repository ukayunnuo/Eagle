@echo off
echo ========================================
echo  LocateAnything - 启动开发环境
echo ========================================
echo.

echo [1/3] 启动后端 API 服务 (端口 8000)...
start "LocateAnything Backend" cmd /k "cd /d %~dp0 && python -m server.main"

echo [2/3] 等待后端启动...
timeout /t 5 /nobreak > nul

echo [3/3] 启动前端开发服务 (端口 3000)...
start "LocateAnything Frontend" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo.
echo ========================================
echo  服务已启动！
echo  - 前端: http://localhost:3000
echo  - 后端: http://localhost:8000
echo  - API 文档: http://localhost:8000/docs
echo ========================================
echo.
pause
