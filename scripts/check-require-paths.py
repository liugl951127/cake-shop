#!/usr/bin/env python3
"""
check-require-paths.py - 检查所有 require 路径是否真实存在
问题: tabBar 在主包时,深度算错 (../ 数量不对),导致 require 找不到
"""
import re
import sys
from pathlib import Path

RED = "\033[0;31m"
GREEN = "\033[0;32m"
BLUE = "\033[0;34m"
NC = "\033[0m"

PASS = 0
FAIL = 0
ERRORS = []

def fail(m):
    global FAIL
    print(f"  {RED}❌ {m}{NC}")
    FAIL += 1
    ERRORS.append(m)

def ok(m):
    global PASS
    print(f"  {GREEN}✅ {m}{NC}")
    PASS += 1

def main():
    root = Path.cwd() / "miniprogram"
    if not root.exists():
        root = Path(__file__).parent.parent / "miniprogram"

    js_files = list(root.rglob("*.js"))
    print(f"{BLUE}📁 扫描 {len(js_files)} 个 JS 文件{NC}\n")

    for js in js_files:
        if any(p in str(js) for p in ("node_modules", "__pycache__", "miniprogram_npm")):
            continue
        try:
            content = js.read_text(encoding="utf-8")
        except Exception:
            continue

        # 找 require 路径
        for m in re.finditer(r'require\(\s*[\'"]([^\'"]+)[\'"]\s*\)', content):
            req = m.group(1)
            # 跳过 node 内置/绝对路径
            if not req.startswith("."):
                continue
            # 解析
            base = js.parent
            target = (base / req).resolve()
            # 兼容: 路径加 .js 后缀
            if not target.exists() and not target.with_suffix(".js").exists():
                # 可能是 package
                if not (target / "index.js").exists():
                    rel = js.relative_to(Path.cwd())
                    fail(f"{rel}: require('{req}') -> {target} 不存在")

    print(f"\n{BLUE}══════════════════════════════{NC}")
    print(f"{GREEN}通过: {PASS}{NC}  {RED}失败: {FAIL}{NC}")
    if FAIL == 0:
        print(f"{GREEN}🎉 全部 require 路径有效!{NC}")
    else:
        print(f"{RED}⚠️  {FAIL} 个路径错误{NC}")
        for e in ERRORS[:20]:
            print(f"  - {e}")
    return 0 if FAIL == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
