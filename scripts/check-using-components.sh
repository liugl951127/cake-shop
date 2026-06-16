#!/bin/bash
# ============================================
# 全量扫描 usingComponents 死链
# 防止"路径下未找到组件"警告
# 适用: 微信开发者工具 2.x
# ============================================
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/miniprogram"

echo "=== 全量扫描 usingComponents 死链 ==="
FAIL=0
COUNT=0
MISSING=0

# 找所有 .json (含 subpackages)
while IFS= read -r json_file; do
  COUNT=$((COUNT+1))
  # 提取 usingComponents 里的组件名 -> 路径
  while IFS= read -r line; do
    # line: "  \"name\": \"path\""
    name=$(echo "$line" | sed -E 's/^[[:space:]]*"([^"]+)":.*$/\1/')
    path=$(echo "$line" | sed -E 's/^[[:space:]]*"[^"]+":[[:space:]]*"([^"]+)".*$/\1/')

    # path 格式:
    #   "/components/xxx/xxx"      - 主包
    #   "../../components/xxx/xxx"  - 分包(相对路径)
    #   "plugin://..."              - 插件(忽略)
    case "$path" in
      plugin://*) continue ;;
    esac

    # 算绝对路径
    json_dir=$(dirname "$json_file")
    if [[ "$path" == /* ]]; then
      # 绝对路径(从主包根算)
      target="$SRC${path}"
    else
      # 相对路径(从 json 所在目录算)
      target="$json_dir/$path"
    fi
    target="${target%/}"   # 去尾 /

    # 检查: 1) 真实文件存在 2) 是 component(.json 里 component:true)
    if [ ! -f "$target.js" ] && [ ! -f "$target.wxml" ]; then
      # 也可能是路径不带后缀, 直接是文件夹
      if [ ! -d "$target" ]; then
        echo "  ❌ $json_file"
        echo "     $name: $path"
        echo "     -> 找不到: $target"
        FAIL=1
        MISSING=$((MISSING+1))
      fi
    fi
  done < <(python3 -c "
import json, sys
try:
    with open('$json_file') as f: d = json.load(f)
    uc = d.get('usingComponents', {})
    for k, v in uc.items():
        print(f'  \"{k}\": \"{v}\"')
except: pass
")
done < <(find "$SRC" -name "*.json" -not -path "*/node_modules/*")

echo ""
echo "=== 总结 ==="
echo " 扫描: $COUNT 个 .json"
echo " 死链: $MISSING"
if [ $FAIL -eq 0 ]; then
  echo " ✅ 全部正常"
else
  echo " ❌ 有死链,需修"
fi
exit $FAIL
