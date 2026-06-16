#!/bin/bash
# ============================================
# 未使用组件 / 文件检查
# 防止微信开发者工具报"无使用组件 / 无依赖文件"
# ============================================
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/miniprogram"

echo "=== 检查 components/ 未被引用的组件 ==="
FAIL=0
for c in "$SRC"/components/*/; do
  [ -d "$c" ] || continue
  name=$(basename "$c")
  # 在 wxml/json 找引用 (usingComponents 字段)
  refs=$(grep -rln "\"$name\"" "$SRC" 2>/dev/null | grep -v "components/$name/" | head -3)
  if [ -z "$refs" ]; then
    echo "  ❌ $name: 0 引用"
    FAIL=1
  else
    cnt=$(echo "$refs" | wc -l)
    echo "  ✅ $name: $cnt 处"
  fi
done

echo ""
echo "=== 检查 utils/ 未被 require 的 js ==="
for f in "$SRC"/utils/*.js; do
  [ -f "$f" ] || continue
  name=$(basename "$f" .js)
  # 跳过 cloud-shim (app.js require)
  [ "$name" = "cloud-shim" ] && continue
  # 找引用 (require('./utils/xxx'))
  refs=$(grep -rln "utils/$name" "$SRC" 2>/dev/null | grep -v "utils/$name.js" | grep -v "components/" | head -3)
  if [ -z "$refs" ]; then
    echo "  ⚠️  $name.js: 0 引用 (可能废弃,人工确认)"
  else
    cnt=$(echo "$refs" | wc -l)
    echo "  ✅ $name.js: $cnt 处"
  fi
done

echo ""
echo "=== dist/ 残留检查 ==="
if [ -d "$ROOT/dist/miniprogram" ]; then
  for n in chatClient.js i18n.js upload.js; do
    if [ -f "$ROOT/dist/miniprogram/utils/$n" ]; then
      echo "  ❌ dist/utils/$n 残留"
      FAIL=1
    fi
  done
  for c in count-num payment-keypad secure-field skeleton sms-code-input goods-card toast; do
    if [ -d "$ROOT/dist/miniprogram/components/$c" ]; then
      echo "  ❌ dist/components/$c 残留"
      FAIL=1
    fi
  done
fi

if [ $FAIL -eq 0 ]; then
  echo ""
  echo "✅ 全部干净"
else
  echo ""
  echo "❌ 有问题需要修"
fi
exit $FAIL
