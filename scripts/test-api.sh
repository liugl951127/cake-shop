#!/bin/bash
# ============================================
# 真实接口测试脚本
# 验证后端 Spring Boot 启动后业务接口正常
# 用法: ./test-api.sh
# ============================================
BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
USERNAME="${USERNAME:-admin}"
PASSWORD="${PASSWORD:-admin123}"

echo "=========================================="
echo " 真实接口测试"
echo " Base URL: $BASE_URL"
echo "=========================================="

# 1) 登录拿 token
LOGIN_RES=$(curl -s -X POST "$BASE_URL/api/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo "$LOGIN_RES" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败:"
  echo "$LOGIN_RES" | head -c 300
  exit 1
fi
echo "✅ 登录成功: ${TOKEN:0:50}..."

# 2) 批量测试
test_one() {
  local desc="$1" method="$2" url="$3"
  local code=$(curl -s -o /tmp/resp.txt -w "%{http_code}" -X "$method" "$BASE_URL$url" -H "Authorization: Bearer $TOKEN")
  local body=$(head -c 80 /tmp/resp.txt)
  if [[ "$body" == *"\"code\":0"* || "$body" == *"\"status\":\"UP\""* || "$code" == "200" ]]; then
    echo "  ✅ $desc ($code)"
    return 0
  else
    echo "  ❌ $desc ($code) $body"
    return 1
  fi
}

ok=0; fail=0
test_one "商品列表"    GET "/api/goods?page=1&size=2"          && ok=$((ok+1)) || fail=$((fail+1))
test_one "商品详情"    GET "/api/goods/1"                      && ok=$((ok+1)) || fail=$((fail+1))
test_one "公告列表"    GET "/api/api/v1/notice?page=1&size=2"  && ok=$((ok+1)) || fail=$((fail+1))
test_one "优惠券"      GET "/api/api/v1/coupon?page=1&size=2"  && ok=$((ok+1)) || fail=$((fail+1))
test_one "会员"        GET "/api/api/v1/member?page=1&size=2"  && ok=$((ok+1)) || fail=$((fail+1))
test_one "订单"        GET "/api/orders?page=1&size=2"         && ok=$((ok+1)) || fail=$((fail+1))
test_one "购物车"      GET "/api/api/v1/cart"                  && ok=$((ok+1)) || fail=$((fail+1))
test_one "收藏"        GET "/api/api/v1/favorite"              && ok=$((ok+1)) || fail=$((fail+1))
test_one "员工"        GET "/api/employees?page=1&size=2"      && ok=$((ok+1)) || fail=$((fail+1))
test_one "审计"        GET "/api/audit?page=1&size=2"          && ok=$((ok+1)) || fail=$((fail+1))
test_one "租户"        GET "/api/tenants?page=1&size=2"        && ok=$((ok+1)) || fail=$((fail+1))
test_one "健康检查"    GET "/api/actuator/health"              && ok=$((ok+1)) || fail=$((fail+1))

echo ""
echo "=========================================="
echo " ✅ $ok / ❌ $fail"
echo "=========================================="
exit $fail
