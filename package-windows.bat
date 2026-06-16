@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

:: ============================================================
::  甜心蛋糕 - Windows 一键打包脚本 v1.0
::  功能: 编译 Spring Boot + Vue 3 + 微信小程序 + 打包成 ZIP
::  输出: dist/ 目录(可部署)
:: ============================================================

echo.
echo ============================================================
echo   甜心蛋糕 - 一键打包脚本 (Windows)
echo   时间: %date% %time%
echo ============================================================
echo.

cd /d %~dp0

:: ---------- 0. 检查工具 ----------
echo [0/6] 检查环境工具...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js 未安装
    echo 下载: https://nodejs.org/
    pause
    exit /b 1
)

where java >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Java 未安装
    pause
    exit /b 1
)

where mvn >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️ Maven 未安装,尝试用 mvnw...
    if not exist "backend\mvnw.cmd" (
        echo ❌ 没找到 mvnw.cmd
        pause
        exit /b 1
    )
    set MVN=backend\mvnw.cmd
) else (
    set MVN=mvn
)

echo ✅ 工具就绪
node --version
java -version 2>&1 | findstr /R "version"
echo.

:: ---------- 1. 清理旧产物 ----------
echo [1/6] 清理旧产物...
if exist dist rmdir /s /q dist
if exist backend\target rmdir /s /q backend\target
if exist admin-vue\dist rmdir /s /q admin-vue\dist
if exist admin-vue\node_modules (
    echo 保留 node_modules(加速后续打包)
)
mkdir dist 2>nul
echo ✅ 清理完成
echo.

:: ---------- 2. 后端打包 ----------
echo [2/6] 编译 Spring Boot 后端...
cd backend
call %MVN% -B clean package -DskipTests
if %errorlevel% neq 0 (
    echo ❌ 后端编译失败
    cd ..
    pause
    exit /b 1
)
cd ..
echo ✅ 后端打包完成
echo.

:: ---------- 3. Vue 后台打包 ----------
echo [3/6] 编译 Vue 3 后台...
cd admin-vue
if not exist node_modules (
    echo 首次安装依赖(可能需要几分钟)...
    call npm install
    if %errorlevel% neq 0 (
        echo ⚠️ npm install 失败,试试国内镜像:
        echo npm config set registry https://registry.npmmirror.com
        cd ..
        pause
        exit /b 1
    )
)
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Vue 打包失败
    cd ..
    pause
    exit /b 1
)
cd ..
echo ✅ Vue 后台打包完成
echo.

:: ---------- 4. 复制产物 ----------
echo [4/6] 复制产物到 dist/...

:: 4.1 后端 jar
copy /Y backend\target\*.jar dist\backend.jar >nul
if %errorlevel% neq 0 (
    echo ❌ 找不到 backend jar
    pause
    exit /b 1
)
echo   ✅ backend.jar

:: 4.2 Vue 静态资源
if exist admin-vue\dist (
    xcopy /E /I /Y admin-vue\dist dist\admin-vue 1>nul
    echo   ✅ admin-vue\ (Vue 静态)
)

:: 4.3 微信小程序源码
if exist miniprogram (
    xcopy /E /I /Y miniprogram dist\miniprogram 1>nul
    echo   ✅ miniprogram\ (微信小程序源码)
)

:: 4.4 云函数
if exist cloudfunctions (
    xcopy /E /I /Y cloudfunctions dist\cloudfunctions 1>nul
    echo   ✅ cloudfunctions\ (云函数源码)
)

:: 4.5 Spring Boot application yml
copy /Y backend\src\main\resources\application*.yml dist\ >nul 2>&1
echo   ✅ application*.yml

:: 4.6 README
copy /Y README.md dist\ >nul 2>&1
echo   ✅ README.md
echo.

:: ---------- 5. 写部署说明 ----------
echo [5/6] 生成部署文档...

set DEPLOY_FILE=dist\部署说明.txt
(
echo 甜心蛋糕 - 部署包
echo ========================
echo 构建时间: %date% %time%
echo.
echo 目录结构:
echo   backend.jar       - Spring Boot 后端可执行 JAR
echo   admin-vue/        - Vue 3 后台静态资源
echo   miniprogram/      - 微信小程序源码(用开发者工具打开)
echo   cloudfunctions/   - 微信云开发云函数源码
echo   application*.yml  - Spring Boot 配置(放同一目录)
echo.
echo 启动后端:
echo   java -jar backend.jar --spring.profiles.active=prod
echo.
echo 部署 Vue:
echo   把 admin-vue/ 目录拷到 Nginx 静态目录
echo   nginx 配置:
echo     location /admin/ {
echo       alias /var/www/admin-vue/;
echo       try_files $uri $uri/ /index.html;
echo     }
echo.
echo 部署云函数:
echo   使用微信开发者工具上传 cloudfunctions/* 目录
echo.
echo 部署小程序:
echo   微信开发者工具 -^> 导入项目 -^> 选 miniprogram/ 目录
echo   填入自己的 appid 即可
) > %DEPLOY_FILE%
echo ✅ 部署说明已生成
echo.

:: ---------- 6. 压缩 ----------
echo [6/6] 压缩为 ZIP...

set TS=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TS=%TS: =0%
set ZIP_NAME=cake-shop-%TS%.zip

cd dist
powershell -NoProfile -Command "Compress-Archive -Path * -DestinationPath ..\%ZIP_NAME% -Force"
cd ..

if exist %ZIP_NAME% (
    echo.
    echo ============================================================
    echo   🎉 打包完成!
    echo ============================================================
    echo.
    echo   📦 输出: %ZIP_NAME%
    for %%I in (%ZIP_NAME%) do echo   📊 大小: %%~zI 字节
    echo.
    echo   📁 dist\ 目录(已解压版):
    dir /B dist
    echo.
) else (
    echo ❌ 压缩失败
    pause
    exit /b 1
)

echo 后续操作:
echo   1. 把 %ZIP_NAME% 拷到服务器
echo   2. 解压后跑: java -jar backend.jar
echo   3. 部署 admin-vue/ 到 Nginx
echo   4. 上传 cloudfunctions/ 到微信云开发
echo   5. 微信开发者工具导入 miniprogram/
echo.
pause
