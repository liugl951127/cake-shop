@echo off
chcp 65001 > nul
echo.
echo ============================================================
echo   甜心蛋糕 - Vue 3 后台 启动脚本 (Windows)
echo ============================================================
echo.

cd /d %~dp0

REM 检查 node
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js 未安装
    echo 请下载安装: https://nodejs.org/ (LTS 18+)
    pause
    exit /b 1
)

node --version
echo.

REM 检查 npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm 未安装
    pause
    exit /b 1
)

npm --version
echo.

REM 第一次运行先装依赖
if not exist "node_modules" (
    echo 📦 第一次运行,正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败
        echo 试试用国内镜像:
        echo npm config set registry https://registry.npmmirror.com
        echo npm install
        pause
        exit /b 1
    )
    echo.
)

REM 启动 dev 服务器
echo 🚀 启动 Vue 3 开发服务器...
echo.
echo    URL:    http://localhost:8081
echo    API:    http://localhost:8080/api  (需先启动 Spring Boot)
echo.
echo 关闭此窗口将停止服务器
echo.

call npm run dev
pause
