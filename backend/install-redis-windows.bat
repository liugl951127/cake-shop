@echo off
chcp 65001 > nul
setlocal

echo.
echo ============================================================
echo   甜心蛋糕 - Redis 一键安装启动脚本
echo   Windows 10/11
echo ============================================================
echo.

REM ---------- 1. 检查 Docker ----------
where docker >nul 2>&1
if %errorlevel% equ 0 (
    echo [1/4] 检测到 Docker ✅
    echo.
    echo 正在启动 Redis 容器...
    docker run -d --name cake-redis -p 6379:6379 -v redis_data:C:/redis_data redis:7-alpine
    timeout /t 3 /nobreak > nul
    echo.
    echo 验证连接...
    goto :verify
)

REM ---------- 2. 检查 WSL ----------
wsl --status >nul 2>&1
if %errorlevel% equ 0 (
    echo [2/4] 检测到 WSL ✅
    echo.
    echo 正在 WSL 中安装 Redis...
    wsl -u root -- sh -c "apt-get update -qq && apt-get install -y redis-server > /dev/null 2>&1 && service redis-server start"
    echo Redis 已在 WSL 启动
    echo.
    echo 验证连接...
    goto :verify
)

REM ---------- 3. 用 Memurai(原生 Windows Redis 替代) ----------
echo [3/4] 没找到 Docker/WSL,推荐安装 Memurai(原生 Windows Redis)
echo.
echo 下载地址: https://www.memurai.com/get-memurai
echo 安装后,会自动作为 Windows 服务运行,端口 6379
echo.
echo 是否现在下载? (Y/N)
set /p CHOICE=
if /i "%CHOICE%"=="Y" (
    echo 正在下载 Memurai...
    start https://www.memurai.com/get-memurai
    echo 请安装后重新运行本脚本
    pause
    exit /b
) else (
    echo 跳过自动下载
)

REM ---------- 4. 不用 Redis,降级启动 ----------
echo.
echo [4/4] 你将使用降级模式(进程内 LocalCache,无需 Redis)
echo 修改 application-dev.yml 的 cakeshop.redis.enabled: false
echo.
echo 启动 Spring Boot...
mvn spring-boot:run
pause
exit /b

:verify
REM ---------- 验证 ----------
echo.
echo 测试 Redis 连接...
where redis-cli >nul 2>&1
if %errorlevel% equ 0 (
    redis-cli -h 127.0.0.1 -p 6379 ping
    if %errorlevel% equ 0 (
        echo.
        echo ✅ Redis 可用
        echo.
        echo 启动 Spring Boot...
        echo mvn spring-boot:run
        mvn spring-boot:run
    ) else (
        echo ❌ Redis 不可用
        echo 改用降级模式: cakeshop.redis.enabled=false
    )
) else (
    echo redis-cli 未安装,但只要端口 6379 可用即可
    echo 启动 Spring Boot...
    mvn spring-boot:run
)
pause
