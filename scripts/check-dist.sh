#!/bin/bash
# ============================================
# dist 同步检查 + 自动修复
# 把分包的 utils/ 同步到 dist/, 保证部署包和开发版本一致
# ============================================
set -e

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/miniprogram"
DST="$ROOT/dist/miniprogram"

if [ ! -d "$DST" ]; then
  echo "dist/ 不存在,跳过"
  exit 0
fi

echo "=== 检查主包 utils/ 不应有分包文件 ==="
FAIL=0
for n in chatClient.js i18n.js upload.js; do
  if [ -f "$DST/utils/$n" ]; then
    echo "  ❌ 主包 utils/$n 残留"
    rm -f "$DST/utils/$n"
    echo "    -> 已删除"
    FAIL=1
  fi
done

echo ""
echo "=== 同步分包 utils/ ==="
for pkg in package-user package-chat package-promo; do
  if [ -d "$SRC/$pkg/utils" ]; then
    mkdir -p "$DST/$pkg/utils"
    cp -r "$SRC/$pkg/utils/." "$DST/$pkg/utils/"
    echo "  ✅ $pkg/utils 同步: $(ls $SRC/$pkg/utils | wc -l) 个文件"
  fi
done

echo ""
if [ $FAIL -eq 0 ]; then
  echo "✅ dist/ 干净"
else
  echo "⚠️  已修复, 请重新编译微信开发者工具"
fi
exit 0
