@echo off
chcp 65001 >nul
title 织梦AI v2 - 开发服务器

echo.
echo  🧵 织梦AI v2 正在启动...
echo.

:: 先关闭占用 3000 端口的旧进程（如果有的话）
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    echo  ⚡ 发现端口 3000 被占用 (PID: %%a)，正在关闭...
    taskkill /F /PID %%a >nul 2>&1
)

:: 同时关闭 3001 端口（防止之前开在这里）
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: 等待端口释放
timeout /t 1 /nobreak >nul

cd /d "%~dp0"
echo  🌐 将在 http://localhost:3000 启动...
echo  ⚠️ 请始终使用 localhost:3000 访问（确保历史数据不丢失）
echo.

npm run dev
pause
