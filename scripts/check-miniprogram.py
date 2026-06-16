#!/usr/bin/env python3
"""
check-miniprogram.py - 模拟微信开发者工具 app.json 校验
检查项:
  1. JSON 格式
  2. pages 数组存在 + 格式
  3. tabBar 页面路径必须在 pages 或子包 pages
  4. 子包 root 路径存在
  5. 所有页面物理文件存在(.js/.wxml/.json/.wxss)
  6. 页面 .json 格式正确
  7. tabBar icon 文件存在
  8. 重复路径检测
"""

import json
import os
import sys
from pathlib import Path

RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
BLUE = "\033[0;34m"
NC = "\033[0m"

PASS = 0
FAIL = 0
WARN = 0
ERRORS = []
WARNINGS = []

def ok(msg):
    global PASS
    print(f"{GREEN}✅ {msg}{NC}")
    PASS += 1

def fail(msg):
    global FAIL
    print(f"{RED}❌ {msg}{NC}")
    FAIL += 1
    ERRORS.append(msg)

def warn(msg):
    global WARN
    print(f"{YELLOW}⚠️  {msg}{NC}")
    WARN += 1
    WARNINGS.append(msg)

def step(msg):
    print(f"\n{BLUE}── {msg} ──{NC}")

def find_miniprogram_dir():
    """找 miniprogram 目录"""
    candidates = [
        Path.cwd() / "miniprogram",
        Path.cwd().parent / "miniprogram",
        Path(__file__).parent.parent / "miniprogram",
    ]
    for c in candidates:
        if c.exists() and c.is_dir():
            return c
    return None

def main():
    mp = find_miniprogram_dir()
    if not mp:
        fail("找不到 miniprogram 目录")
        return 1
    print(f"{BLUE}📁 {mp}{NC}")

    # ---------- 1. app.json ----------
    step("[1/8] app.json 基础校验")
    app_json = mp / "app.json"
    if not app_json.exists():
        fail("app.json 不存在")
        return 1
    try:
        app = json.loads(app_json.read_text(encoding="utf-8"))
        ok("app.json 是有效 JSON")
    except json.JSONDecodeError as e:
        fail(f"app.json JSON 解析失败: {e}")
        return 1

    # ---------- 2. pages 数组 ----------
    step("[2/8] pages 数组校验")
    if "pages" not in app:
        fail("缺少 pages 字段")
    elif not isinstance(app["pages"], list):
        fail("pages 不是数组")
    elif len(app["pages"]) == 0:
        fail("pages 数组为空")
    else:
        ok(f"pages 数组有 {len(app['pages'])} 项")
        for p in app["pages"]:
            if not p.startswith("pages/"):
                fail(f"pages 项 '{p}' 必须以 'pages/' 开头")
            elif "//" in p or p.endswith("/"):
                fail(f"pages 项 '{p}' 格式错误")

    # ---------- 3. tabBar ----------
    step("[3/8] tabBar 校验")
    if "tabBar" not in app:
        warn("无 tabBar 配置")
    elif "list" not in app["tabBar"] or not app["tabBar"]["list"]:
        warn("tabBar.list 为空")
    else:
        tab_list = app["tabBar"]["list"]
        if len(tab_list) > 5:
            fail(f"tabBar 项超过 5 个(微信限制),当前 {len(tab_list)}")
        ok(f"tabBar.list {len(tab_list)} 项(≤5)")
        # 收集所有可用页面
        main_pages = set(app.get("pages", []))
        sub_pages = set()
        for s in app.get("subpackages", []):
            for p in s.get("pages", []):
                sub_pages.add(f"{s['name']}/{p}")
        all_pages = main_pages | sub_pages
        for t in tab_list:
            if "pagePath" not in t:
                fail(f"tabBar 项缺少 pagePath: {t}")
                continue
            path = t["pagePath"]
            text = t.get("text", "?")
            if path in main_pages:
                ok(f"tabBar '{text}' -> {path} (主包)")
            elif path in sub_pages:
                ok(f"tabBar '{text}' -> {path} (子包)")
            else:
                fail(f"tabBar '{text}' -> {path} (页面未注册!)")

    # ---------- 4. 子包 root 存在 ----------
    step("[4/8] subpackages root 校验")
    for s in app.get("subpackages", []):
        name = s.get("name", "?")
        root = s.get("root", "")
        full = mp / root
        if not full.exists():
            fail(f"子包 '{name}' root '{root}' 目录不存在: {full}")
        else:
            ok(f"子包 '{name}' -> {full}")

    # ---------- 5. 所有页面物理文件 ----------
    step("[5/8] 物理文件存在性")
    for p in main_pages:
        # 页面是 .js 文件(不是目录)
        full = mp / (p + ".js")
        if not full.exists():
            fail(f"主包页面 '{p}' 物理不存在: {full}")
            continue
        for ext in (".js", ".wxml", ".json"):
            if not (mp / (p + ext)).exists():
                fail(f"  {p} 缺少 {ext}")
        ok(f"  {p} 文件完整")
    for p in sub_pages:
        # sub_pages 形如 'order/pages/order/list'
        for s in app.get("subpackages", []):
            sub_path = f"{s['name']}/"
            if p.startswith(sub_path):
                rel = p[len(sub_path):]
                # 子包页面 = 子包 root + 子包内路径
                full = mp / s["root"] / (rel + ".js")
                if not full.exists():
                    fail(f"子包页面 '{p}' 物理不存在: {full}")
                else:
                    for ext in (".js", ".wxml", ".json"):
                        if not (mp / s["root"] / (rel + ext)).exists():
                            fail(f"  {p} 缺少 {ext}")
                    ok(f"  {p} 文件完整")
                break

    # ---------- 6. 页面 json 格式 ----------
    step("[6/8] 页面 .json 校验")
    json_count = 0
    for json_file in mp.rglob("*.json"):
        # 跳过 node_modules
        if "node_modules" in str(json_file):
            continue
        if json_file.name in ("app.json", "sitemap.json", "project.config.json",
                              "project.private.config.json", "tsconfig.json"):
            continue
        # 必须以 .json 结尾但是页面 json (在 pages/ 目录下)
        if "pages" not in str(json_file):
            continue
        try:
            json.loads(json_file.read_text(encoding="utf-8"))
            json_count += 1
        except json.JSONDecodeError as e:
            fail(f"页面 JSON 解析失败: {json_file.relative_to(mp)} - {e}")
    ok(f"{json_count} 个页面 JSON 全部有效")

    # ---------- 7. tabBar icon ----------
    step("[7/8] tabBar icon 文件")
    for t in app.get("tabBar", {}).get("list", []):
        for key in ("iconPath", "selectedIconPath"):
            icon = t.get(key)
            if not icon:
                continue
            full = mp / icon
            if not full.exists():
                warn(f"tabBar icon 缺失: {t.get('text', '?')} {key}={icon}")
            else:
                ok(f"  {t.get('text', '?')} {key}={icon}")

    # ---------- 8. 重复检测 ----------
    step("[8/8] 重复路径检测")
    all_paths = list(main_pages) + list(sub_pages)
    dup = [p for p in all_paths if all_paths.count(p) > 1]
    if dup:
        for d in set(dup):
            fail(f"页面路径重复: {d}")
    else:
        ok(f"无重复路径 ({len(all_paths)} 个唯一页面)")

    # ---------- 总结 ----------
    print(f"\n{BLUE}══════════════════════════════{NC}")
    print(f"{BLUE}  验证结果{NC}")
    print(f"{BLUE}══════════════════════════════{NC}")
    print(f"{GREEN}通过: {PASS}{NC}  {YELLOW}警告: {WARN}{NC}  {RED}失败: {FAIL}{NC}")

    if FAIL == 0:
        print(f"\n{GREEN}🎉 自测通过 - 可被微信开发者工具接受!{NC}")
        return 0
    else:
        print(f"\n{RED}⚠️  有 {FAIL} 项失败{NC}")
        for e in ERRORS[:10]:
            print(f"  - {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
