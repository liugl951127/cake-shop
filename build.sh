#!/usr/bin/env bash
# ============================================================
#  甜心蛋糕 - 跨平台一键构建脚本
#  Linux / macOS / Git Bash on Windows
#  用法: ./build.sh
# ============================================================
set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)]${NC} ⚠️  $1"; }
err()  { echo -e "${RED}[$(date +%H:%M:%S)]${NC} ❌ $1"; exit 1; }
step() { echo -e "\n${BLUE}========================================${NC}"; echo -e "${BLUE}▶ $1${NC}"; echo -e "${BLUE}========================================${NC}"; }

# 切到脚本所在目录
cd "$(dirname "$0")"

# ---------- 0. 检查工具 ----------
step "[0/6] 检查环境工具"

command -v node >/dev/null 2>&1 || err "Node.js 未安装 (https://nodejs.org/)"
command -v java >/dev/null 2>&1 || err "Java 未安装"

# 检测 Maven
if command -v mvn >/dev/null 2>&1; then
    MVN="mvn"
elif [ -f "backend/mvnw" ]; then
    MVN="backend/mvnw"
else
    err "Maven 未安装且没有 mvnw"
fi

log "Node:   $(node --version)"
log "Java:   $(java -version 2>&1 | head -1)"
log "Maven:  $(${MVN} --version 2>&1 | head -1)"

# ---------- 1. 清理 ----------
step "[1/6] 清理旧产物"

rm -rf dist
rm -rf backend/target
rm -rf admin-vue/dist
mkdir -p dist
log "清理完成"

# ---------- 2. 后端打包 ----------
step "[2/6] 编译 Spring Boot 后端"

cd backend
${MVN} -B clean package -DskipTests
err_code=$?
cd ..
[ $err_code -ne 0 ] && err "后端编译失败"

log "后端打包完成"

# ---------- 3. Vue 打包 ----------
step "[3/6] 编译 Vue 3 后台"

cd admin-vue
if [ ! -d "node_modules" ]; then
    log "首次安装依赖(可能需要几分钟)..."
    npm install
    [ $? -ne 0 ] && err "npm install 失败"
fi
npm run build
[ $? -ne 0 ] && err "Vue 打包失败"
cd ..

log "Vue 后台打包完成"

# ---------- 4. 复制产物 ----------
step "[4/6] 复制产物到 dist/"

# 4.1 后端 jar
JAR_FILE=$(ls backend/target/*.jar 2>/dev/null | grep -v "sources\|javadoc" | head -1)
[ -z "$JAR_FILE" ] && err "找不到 backend jar"
cp "$JAR_FILE" dist/backend.jar
log "✅ backend.jar ($(du -h dist/backend.jar | cut -f1))"

# 4.2 Vue 静态
if [ -d "admin-vue/dist" ]; then
    cp -r admin-vue/dist dist/admin-vue
    log "✅ admin-vue/ ($(du -sh admin-vue/dist | cut -f1))"
fi

# 4.3 微信小程序
if [ -d "miniprogram" ]; then
    cp -r miniprogram dist/miniprogram
    log "✅ miniprogram/ ($(du -sh miniprogram | cut -f1))"
fi

# 4.4 云函数
if [ -d "cloudfunctions" ]; then
    cp -r cloudfunctions dist/cloudfunctions
    log "✅ cloudfunctions/ ($(du -sh cloudfunctions | cut -f1))"
fi

# 4.5 Spring Boot 配置
cp backend/src/main/resources/application*.yml dist/ 2>/dev/null
log "✅ application*.yml"

# 4.6 README
cp README.md dist/ 2>/dev/null
log "✅ README.md"

# ---------- 5. 部署说明 ----------
step "[5/6] 生成部署说明"

cat > dist/部署说明.txt <<EOF
甜心蛋糕 - 部署包
========================
构建时间: $(date +"%Y-%m-%d %H:%M:%S")

目录结构:
  backend.jar       - Spring Boot 后端可执行 JAR
  admin-vue/        - Vue 3 后台静态资源
  miniprogram/      - 微信小程序源码(用开发者工具打开)
  cloudfunctions/   - 微信云开发云函数源码
  application*.yml  - Spring Boot 配置(放同一目录)

启动后端:
  java -jar backend.jar --spring.profiles.active=prod

部署 Vue (Nginx):
  location /admin/ {
    alias /var/www/admin-vue/;
    try_files \$uri \$uri/ /index.html;
  }

部署云函数:
  使用微信开发者工具上传 cloudfunctions/* 目录

部署小程序:
  微信开发者工具 -> 导入项目 -> 选 miniprogram/ 目录
  填入自己的 appid 即可

环境变量 (生产):
  MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB
  REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
  JWT_SECRET (强随机,32+ 字符)
  TCB_ENV_ID (微信云开发环境 ID)
EOF
log "部署说明已生成"

# ---------- 6. 压缩 ----------
step "[6/6] 压缩为 ZIP"

TS=$(date +%Y%m%d_%H%M%S)
ZIP_NAME="cake-shop-${TS}.zip"

cd dist
zip -qr "../${ZIP_NAME}" . 2>/dev/null || {
    # 没装 zip,用 tar
    cd ..
    tar -czf "${ZIP_NAME%.zip}.tar.gz" -C dist .
    log "无 zip 命令,改用 tar.gz"
    FINAL="${ZIP_NAME%.zip}.tar.gz"
    cd ..
    SIZE=$(du -h "$FINAL" | cut -f1)
    echo
    echo "=========================================="
    echo "🎉 打包完成!"
    echo "=========================================="
    echo "📦 $FINAL ($SIZE)"
    echo
    echo "📁 dist/ 内容:"
    ls -la dist
    echo
    exit 0
}
cd ..

if [ -f "${ZIP_NAME}" ]; then
    SIZE=$(du -h "${ZIP_NAME}" | cut -f1)
    echo
    echo "=========================================="
    echo "🎉 打包完成!"
    echo "=========================================="
    echo "📦 ${ZIP_NAME} (${SIZE})"
    echo
    echo "📁 dist/ 内容:"
    ls -la dist
    echo
    echo "后续:"
    echo "  1. 上传 ${ZIP_NAME} 到服务器"
    echo "  2. unzip ${ZIP_NAME}"
    echo "  3. java -jar backend.jar"
    echo "  4. 部署 admin-vue/ 到 Nginx"
fi
