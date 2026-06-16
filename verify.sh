#!/usr/bin/env bash
# ============================================================
#  甜心蛋糕 - 一键验证脚本
#  用途: 检查项目是否能跑(编译/语法/配置)
#  不打包、不启动服务,纯校验
# ============================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0
RESULTS=()

check_pass() { echo -e "${GREEN}✅ $1${NC}"; PASS=$((PASS+1)); RESULTS+=("PASS: $1"); }
check_fail() { echo -e "${RED}❌ $1${NC}"; FAIL=$((FAIL+1)); RESULTS+=("FAIL: $1"); }
check_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; WARN=$((WARN+1)); RESULTS+=("WARN: $1"); }

cd "$(dirname "$0")"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}▶ 甜心蛋糕 - 一键验证${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# ---------- 1. 工具检查 ----------
echo -e "${BLUE}[1/8] 环境工具${NC}"

command -v node >/dev/null 2>&1 && check_pass "Node.js: $(node --version)" || check_fail "Node.js 未安装"
command -v java >/dev/null 2>&1 && check_pass "Java: $(java -version 2>&1 | head -1)" || check_fail "Java 未安装"
command -v mvn >/dev/null 2>&1 && check_pass "Maven: $(mvn --version 2>&1 | head -1)" || check_warn "Maven 未安装"
command -v git >/dev/null 2>&1 && check_pass "Git: $(git --version)" || check_warn "Git 未安装"

# ---------- 2. 文件结构 ----------
echo
echo -e "${BLUE}[2/8] 文件结构${NC}"

[ -f "miniprogram/app.json" ] && check_pass "miniprogram/app.json" || check_fail "miniprogram/app.json 缺失"
[ -d "miniprogram/pages" ] && check_pass "miniprogram/pages/" || check_fail "miniprogram/pages/ 缺失"
[ -d "cloudfunctions" ] && check_pass "cloudfunctions/" || check_fail "cloudfunctions/ 缺失"
[ -d "backend" ] && check_pass "backend/" || check_fail "backend/ 缺失"
[ -f "backend/pom.xml" ] && check_pass "backend/pom.xml" || check_fail "backend/pom.xml 缺失"
[ -d "admin-vue" ] && check_pass "admin-vue/" || check_fail "admin-vue/ 缺失"
[ -f "admin-vue/package.json" ] && check_pass "admin-vue/package.json" || check_fail "admin-vue/package.json 缺失"

# ---------- 3. miniprogram 配置 ----------
echo
echo -e "${BLUE}[3/8] 微信小程序配置${NC}"

if [ -f "miniprogram/app.json" ]; then
    node -e "JSON.parse(require('fs').readFileSync('miniprogram/app.json','utf8'))" 2>/dev/null && check_pass "app.json JSON 有效" || check_fail "app.json JSON 无效"
    
    # tabBar 路径
    TAB_OK=$(node -e "
        const a = JSON.parse(require('fs').readFileSync('miniprogram/app.json','utf8'));
        const pages = a.pages || [];
        const subPages = (a.subpackages || []).flatMap(s => s.pages.map(p => s.name + '/' + p));
        const all = [...pages, ...subPages];
        a.tabBar && a.tabBar.list.forEach(t => {
            if (!all.includes(t.pagePath)) {
                console.log('MISS:' + t.pagePath);
                process.exit(1);
            }
        });
    " 2>&1) || true
    if [ -z "$TAB_OK" ]; then
        check_pass "tabBar 路径全部有效"
    else
        check_fail "tabBar 路径缺失: $TAB_OK"
    fi
fi

# 检查所有 .wxml
WXML=$(find miniprogram -name "*.wxml" 2>/dev/null | wc -l)
check_pass "miniprogram wxml 文件: $WXML"

# ---------- 4. 云函数配置 ----------
echo
echo -e "${BLUE}[4/8] 云函数配置${NC}"

CF_COUNT=$(ls cloudfunctions 2>/dev/null | wc -l)
check_pass "云函数数量: $CF_COUNT"

# 检查有 package.json 的
CF_WITH_PKG=$(find cloudfunctions -maxdepth 2 -name "package.json" 2>/dev/null | wc -l)
if [ "$CF_WITH_PKG" -eq "$CF_COUNT" ]; then
    check_pass "所有云函数都有 package.json"
else
    check_warn "部分云函数缺 package.json ($CF_WITH_PKG/$CF_COUNT)"
fi

# 抽样语法检查
SAMPLE_ERRORS=0
for f in $(find cloudfunctions -maxdepth 2 -name "index.js" 2>/dev/null | head -20); do
    if ! node -c "$f" 2>/dev/null; then
        SAMPLE_ERRORS=$((SAMPLE_ERRORS+1))
    fi
done
[ "$SAMPLE_ERRORS" -eq 0 ] && check_pass "云函数 JS 语法(抽样 20 个)OK" || check_fail "云函数 JS 语法错($SAMPLE_ERRORS)"

# ---------- 5. 后端 Java 配置 ----------
echo
echo -e "${BLUE}[5/8] Spring Boot 后端${NC}"

[ -f "backend/pom.xml" ] && {
    JAVA_VER=$(grep -m1 "java.version" backend/pom.xml | grep -oE "1[78]|[0-9]+" | head -1)
    [ -n "$JAVA_VER" ] && check_pass "Java 版本: $JAVA_VER" || check_warn "Java 版本未明"

    SPRING_VER=$(grep -A 1 "spring-boot-starter-parent" backend/pom.xml | grep -oE "[0-9]+\.[0-9]+\.[0-9]+" | head -1)
    [ -n "$SPRING_VER" ] && check_pass "Spring Boot: $SPRING_VER" || check_warn "Spring Boot 版本未明"
}

[ -f "backend/src/main/resources/application.yml" ] && check_pass "application.yml 存在" || check_fail "application.yml 缺失"
[ -f "backend/src/main/resources/application-dev.yml" ] && check_pass "application-dev.yml 存在" || check_warn "application-dev.yml 缺失"
[ -f "backend/src/main/resources/application-prod.yml" ] && check_pass "application-prod.yml 存在" || check_warn "application-prod.yml 缺失"

# Java 数量
JAVA_FILES=$(find backend/src -name "*.java" 2>/dev/null | wc -l)
check_pass "Java 类数量: $JAVA_FILES"

# ---------- 6. Vue 后台配置 ----------
echo
echo -e "${BLUE}[6/8] Vue 3 后台${NC}"

[ -f "admin-vue/package.json" ] && {
    VUE_VER=$(grep -m1 '"vue"' admin-vue/package.json | grep -oE '[0-9]+\.[0-9]+' | head -1)
    [ -n "$VUE_VER" ] && check_pass "Vue 版本: ^$VUE_VER" || check_warn "Vue 版本未明"
    
    ELEMENT=$(grep -c "element-plus" admin-vue/package.json)
    [ "$ELEMENT" -gt 0 ] && check_pass "Element Plus 已配置" || check_warn "未配置 Element Plus"
}

VIEWS=$(find admin-vue/src/views -name "*.vue" 2>/dev/null | wc -l)
check_pass "Vue 页面数量: $VIEWS"

# 语法检查
if command -v node >/dev/null && [ -d "admin-vue/src" ]; then
    SYNTAX_ERR=0
    for f in $(find admin-vue/src -name "*.vue" 2>/dev/null); do
        # 简单模板完整性检查
        if ! grep -q "<template>" "$f" || ! grep -q "</template>" "$f"; then
            SYNTAX_ERR=$((SYNTAX_ERR+1))
        fi
    done
    [ "$SYNTAX_ERR" -eq 0 ] && check_pass "Vue 模板完整性 OK" || check_warn "Vue 模板异常: $SYNTAX_ERR"
fi

# ---------- 7. 主题色统一 ----------
echo
echo -e "${BLUE}[7/8] 主题色检查${NC}"

INDIGO_MINIPROGRAM=$(grep -rl "6366f1\|4f46e5" miniprogram/styles/ 2>/dev/null | wc -l)
[ "$INDIGO_MINIPROGRAM" -gt 0 ] && check_pass "miniprogram indigo 主题" || check_warn "miniprogram 主题色非 indigo"

INDIGO_VUE=$(grep -c "6366f1" admin-vue/src/assets/main.css 2>/dev/null || echo 0)
[ "$INDIGO_VUE" -gt 0 ] && check_pass "admin-vue indigo 主题" || check_warn "admin-vue 主题色非 indigo"

INDIGO_JAVA=$(grep -c "6366f1" backend/src/main/resources/static/* 2>/dev/null || echo 0)
# 后端用不到

# ---------- 8. 提交 + Git ----------
echo
echo -e "${BLUE}[8/8] Git 状态${NC}"

if [ -d ".git" ]; then
    check_pass "Git 仓库已初始化"
    
    BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
    check_pass "当前分支: $BRANCH"
    
    LAST_COMMIT=$(git log -1 --oneline 2>/dev/null || echo "无提交")
    check_pass "最新提交: $LAST_COMMIT"
    
    UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l)
    if [ "$UNCOMMITTED" -eq 0 ]; then
        check_pass "工作区 clean"
    else
        check_warn "$UNCOMMITTED 个文件未提交"
    fi
else
    check_warn "不是 Git 仓库"
fi

# ---------- 总结 ----------
echo
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  验证结果${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}通过: $PASS${NC}  ${YELLOW}警告: $WARN${NC}  ${RED}失败: $FAIL${NC}"
echo

if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}🎉 验证通过!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  有 $FAIL 项失败,请检查${NC}"
    exit 1
fi
