#!/usr/bin/env python3
"""
fix-require-paths.py - 批量修复 require 路径
  - 子包内的页面: 算深度,补够 ../ 数量到 miniprogram/utils
  - ./nav.js 不存在: 找附近的 nav.js
"""
import re
import sys
import os
from pathlib import Path

RED = "\033[0;31m"
GREEN = "\033[0;32m"
BLUE = "\033[0;34m"
NC = "\033[0m"

FIXED = 0
SKIPPED = 0
WARN = 0

def fix_path(js_file: Path, req: str, target_module: str) -> str:
    """
    js_file: 当前 require 的 .js
    req: 原 require 路径, 如 "../../utils/foo.js"
    target_module: 想引用的模块, 如 "utils/foo.js"
    返回: 修复后的相对路径
    """
    if not req.startswith("."):
        return req

    # 提取 ../ 数量
    m = re.match(r'^((?:\.\./)*)(.*)$', req)
    if not m:
        return req
    cur_dots = len(re.findall(r'\.\./', m.group(1)))
    rest = m.group(2)
    # 解析 rest 后段
    parts = rest.split('/')

    # 目标在 miniprogram/utils/ 还是在 nav.js (在子包根)
    # 这里只处理 utils/ 类
    return req  # 占位,实际用 compute_correct_path


def compute_correct_path(js_file: Path, target_in_miniprogram: str) -> str:
    """
    从 js_file 到 miniprogram/target_in_miniprogram 的相对路径
    js_file: 绝对路径
    target_in_miniprogram: 相对 miniprogram 的路径, 如 "utils/request.js"
    """
    # miniprogram 根 = js_file 的最近 miniprogram 祖先
    cur = js_file
    while cur.name != "miniprogram" and cur.parent != cur:
        cur = cur.parent
    mp_root = cur
    target = mp_root / target_in_miniprogram
    rel = os.path.relpath(target, js_file.parent)
    return rel.replace(os.sep, "/")


def compute_pkg_local_path(js_file: Path, pkg_dir: str, rel_in_pkg: str) -> str:
    """
    从 js_file 到子包内 utils 的相对路径
    pkg_dir: 子包目录, 如 "package-chat"
    rel_in_pkg: 子包内相对路径, 如 "utils/chatClient.js"
    """
    cur = js_file
    while cur.name != "miniprogram" and cur.parent != cur:
        cur = cur.parent
    mp_root = cur
    target = mp_root / pkg_dir / rel_in_pkg
    rel = os.path.relpath(target, js_file.parent)
    return rel.replace(os.sep, "/")


def main():
    root = Path.cwd() / "miniprogram"
    if not root.exists():
        root = Path(__file__).parent.parent / "miniprogram"

    js_files = list(root.rglob("*.js"))
    print(f"{BLUE}📁 扫描 {len(js_files)} 个 JS 文件{NC}\n")

    # 找最近的 nav.js
    nav_locations = {}
    for f in js_files:
        if f.name == "nav.js":
            # 给 nav.js 同目录的页面用
            nav_locations[str(f.parent)] = f

    for js in js_files:
        if any(p in str(js) for p in ("node_modules", "__pycache__", "miniprogram_npm")):
            continue
        try:
            content = js.read_text(encoding="utf-8")
        except Exception:
            continue

        new_content = content
        changes = []

        for m in re.finditer(r'require\(\s*[\'"]([^\'"]+)[\'"]\s*\)', content):
            req = m.group(1)
            if not req.startswith("."):
                continue
            # 解析当前
            try:
                base = js.parent
                target = (base / req).resolve()
            except Exception:
                continue
            if not target.exists() and not target.with_suffix(".js").exists() \
               and not (target / "index.js").exists():
                # 路径错, 修复
                # 情况 1: 是 utils 引用 (../../utils/X.js)
                util_m = re.match(r'^(?:\.\./)+utils/(.+)$', req)
                if util_m:
                    module_name = "utils/" + util_m.group(1)
                    new_req = compute_correct_path(js, module_name)
                    changes.append((m.group(0), f"require('{new_req}')"))
                    continue
                # 情况 2: 是 ./nav.js - 统一指向 miniprogram/utils/nav.js
                if req == "./nav.js" or req == "./nav" or re.match(r'^\.\./+nav(\.js)?$', req):
                    new_req = compute_correct_path(js, "utils/nav.js").replace(".js", "")
                    changes.append((m.group(0), f"require('{new_req}')"))
                    continue
                # 情况 3: 是 ./monitor.js 等同级文件 - 路径里有 utils/ 多余
                util_self_m = re.match(r'^\./utils/(.+)$', req)
                if util_self_m:
                    module_name = "utils/" + util_self_m.group(1)
                    new_req = compute_correct_path(js, module_name)
                    changes.append((m.group(0), f"require('{new_req}')"))
                    continue

        # 应用修改
        for old, new in changes:
            new_content = new_content.replace(old, new, 1)

        if new_content != content:
            js.write_text(new_content, encoding="utf-8")
            rel = js.relative_to(Path.cwd())
            print(f"  {GREEN}✅ 修复 {rel}: {len(changes)} 处{NC}")
            global FIXED
            FIXED += 1

    print(f"\n{BLUE}══════════════════════════════{NC}")
    print(f"{GREEN}修复文件: {FIXED}{NC}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
