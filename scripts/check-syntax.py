#!/usr/bin/env python3
"""
check-syntax.py - 全项目语法检查
覆盖:JS / JSON / WXML / WXSS / Vue / Java

按文件类型分发到对应的 checker:
  - .js / .mjs -> Node.js --check
  - .json      -> json.loads
  - .wxml      -> check-wxml (内置)
  - .wxss      -> braces + selectors 基础
  - .vue       -> 3 段解析 (template/script/style)
  - .java      -> mvn compile (外部命令)
"""

import json
import os
import re
import subprocess
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

def ok(m):
    global PASS
    print(f"  {GREEN}✅ {m}{NC}")
    PASS += 1

def fail(m):
    global FAIL
    print(f"  {RED}❌ {m}{NC}")
    FAIL += 1
    ERRORS.append(m)

def warn(m):
    global WARN
    print(f"  {YELLOW}⚠️  {m}{NC}")
    WARN += 1

def step(msg):
    print(f"\n{BLUE}── {msg} ──{NC}")

def find_miniprogram():
    cands = [
        Path.cwd() / "miniprogram",
        Path(__file__).parent.parent / "miniprogram",
    ]
    for c in cands:
        if c.exists():
            return c
    return None

def find_root():
    return Path(__file__).parent.parent

# ============================================================
# JS 检查
# ============================================================
def check_js(path: Path):
    """node -c 检查"""
    try:
        r = subprocess.run(
            ["node", "-c", str(path)],
            capture_output=True, text=True, timeout=5
        )
        if r.returncode == 0:
            return True, ""
        return False, r.stderr.strip().split('\n')[0]
    except subprocess.TimeoutExpired:
        return False, "timeout"
    except FileNotFoundError:
        return None, "no node"
    except Exception as e:
        return False, str(e)

# ============================================================
# JSON 检查
# ============================================================
def check_json(path: Path):
    try:
        json.loads(path.read_text(encoding="utf-8"))
        return True, ""
    except json.JSONDecodeError as e:
        return False, f"line {e.lineno}: {e.msg}"
    except Exception as e:
        return False, str(e)

# ============================================================
# WXML 检查
# ============================================================
VOID = {"image", "input", "icon", "switch", "slider", "progress",
        "audio", "video", "live-player", "live-pusher",
        "open-data", "web-view", "ad"}
CONTAINER = {"view", "text", "button", "scroll-view", "swiper", "swiper-item",
             "navigator", "form", "checkbox", "checkbox-group", "radio",
             "radio-group", "picker", "picker-view", "picker-view-column",
             "label", "slot", "template", "movable-area", "movable-view",
             "cover-view", "cover-image", "block", "rich-text",
             "functional-page-navigator"}

def check_wxml(path: Path):
    try:
        raw = path.read_text(encoding="utf-8")
    except Exception as e:
        return False, str(e)
    text = re.sub(r'<!--.*?-->', '', raw, flags=re.DOTALL)

    # 1. 标签平衡
    tag_re = re.compile(r'<(/?)([a-zA-Z][a-zA-Z0-9_-]*)([^>]*?)(/?)>', re.DOTALL)
    line_starts = [0]
    for i, ch in enumerate(text):
        if ch == '\n':
            line_starts.append(i + 1)
    def pos2line(pos):
        lo, hi = 0, len(line_starts) - 1
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if line_starts[mid] <= pos:
                lo = mid
            else:
                hi = mid - 1
        return lo + 1

    stack = []
    for m in tag_re.finditer(text):
        closing = m.group(1) == '/'
        tag = m.group(2).lower()
        self_close = m.group(4) == '/'
        if closing:
            if stack and stack[-1][0] == tag:
                stack.pop()
            # 任何关闭标签不 push
            continue
        if not self_close and tag in CONTAINER:
            stack.append((tag, pos2line(m.start())))

    if stack:
        for t, ln in stack:
            return False, f"line {ln}: <{t}> 未闭合"

    # 2. text 3 层以上嵌套
    lines = text.split('\n')
    in_text = 0
    line_no = 0
    for line in lines:
        line_no += 1
        idx = 0
        while idx < len(line):
            tm = re.search(r'<(/?)text\b[^>]*>', line[idx:])
            if not tm:
                break
            if tm.group(1) == '/':
                in_text = max(0, in_text - 1)
            else:
                if in_text >= 2:
                    return False, f"line {line_no}: <text> 3 层嵌套"
                in_text += 1
            idx += tm.end()

    return True, ""

# ============================================================
# WXSS / CSS 基础检查
# ============================================================
def check_wxss(path: Path):
    try:
        content = path.read_text(encoding="utf-8")
    except Exception as e:
        return False, str(e)
    # 简单查:大括号配对
    open_c = content.count('{')
    close_c = content.count('}')
    if open_c != close_c:
        return False, f"{{ = {open_c}, }} = {close_c}"
    # 注释平衡
    if content.count('/*') != content.count('*/'):
        return False, "/* */ 不平衡"
    return True, ""

# ============================================================
# Vue 检查(3 段解析)
# ============================================================
def check_vue(path: Path):
    try:
        content = path.read_text(encoding="utf-8")
    except Exception as e:
        return False, str(e)
    # 检查有 <template> <script> <style> 段
    has_template = bool(re.search(r'<template[\s>]', content))
    has_script = bool(re.search(r'<script[\s>]', content))
    if not has_template and not has_script:
        return False, "缺 <template> 或 <script>"

    # 提取 <script> 内容用 node 检查
    m = re.search(r'<script[^>]*>(.*?)</script>', content, re.DOTALL)
    if m:
        js_content = m.group(1)
        # 写到临时文件
        tmp = path.parent / f".__check_{path.name}.js"
        try:
            tmp.write_text(js_content, encoding="utf-8")
            r = subprocess.run(
                ["node", "-c", str(tmp)],
                capture_output=True, text=True, timeout=5
            )
            tmp.unlink()
            if r.returncode != 0:
                return False, f"<script>: {r.stderr.strip().split(chr(10))[0]}"
        except Exception as e:
            if tmp.exists():
                tmp.unlink()
            return False, f"script check fail: {e}"

    return True, ""

# ============================================================
# 主流程
# ============================================================
def main():
    root = find_root()
    print(f"{BLUE}📁 {root}{NC}")

    # ---------- JS ----------
    step("[1/6] JS 语法")
    js_files = list((root / "cloudfunctions").rglob("*.js")) + \
               list((root / "miniprogram").rglob("*.js")) + \
               list((root / "admin-vue" / "src").rglob("*.js")) + \
               list((root / "scripts").glob("*.py"))
    js_files = [f for f in js_files if "node_modules" not in str(f) and "__pycache__" not in str(f) and f.suffix == ".js"]
    print(f"  扫描 {len(js_files)} 个 .js 文件")
    errors = 0
    for f in js_files:
        ok_flag, msg = check_js(f)
        if ok_flag is True:
            pass  # 不每个 ok,只显示错误
        elif ok_flag is False:
            rel = f.relative_to(root)
            fail(f"{rel}: {msg}")
            errors += 1
    if errors == 0:
        ok(f"全部 {len(js_files)} 个 JS 文件通过")
    else:
        fail(f"{errors} 个 JS 语法错误")

    # ---------- JSON ----------
    step("[2/6] JSON 语法")
    json_files = []
    for d in [root / "miniprogram", root / "admin-vue", root / "cloudfunctions", root / "backend"]:
        if d.exists():
            for f in d.rglob("*.json"):
                if "node_modules" not in str(f) and "target" not in str(f) and "dist" not in str(f):
                    json_files.append(f)
    print(f"  扫描 {len(json_files)} 个 .json 文件")
    jerrors = 0
    for f in json_files:
        ok_flag, msg = check_json(f)
        if ok_flag is False:
            rel = f.relative_to(root)
            fail(f"{rel}: {msg}")
            jerrors += 1
    if jerrors == 0:
        ok(f"全部 {len(json_files)} 个 JSON 文件通过")
    else:
        fail(f"{jerrors} 个 JSON 语法错误")

    # ---------- WXML ----------
    step("[3/6] WXML 语法")
    mp = find_miniprogram()
    if mp:
        wxml_files = list(mp.rglob("*.wxml"))
        print(f"  扫描 {len(wxml_files)} 个 .wxml 文件")
        werrors = 0
        for f in wxml_files:
            ok_flag, msg = check_wxml(f)
            if ok_flag is False:
                rel = f.relative_to(root)
                fail(f"{rel}: {msg}")
                werrors += 1
        if werrors == 0:
            ok(f"全部 {len(wxml_files)} 个 WXML 文件通过")
        else:
            fail(f"{werrors} 个 WXML 语法错误")
    else:
        warn("找不到 miniprogram")

    # ---------- WXSS / CSS ----------
    step("[4/6] WXSS/CSS 语法")
    css_files = []
    for d in [mp, root / "admin-vue"]:
        if d and d.exists():
            for ext in ("*.wxss", "*.css"):
                for f in d.rglob(ext):
                    if "node_modules" not in str(f):
                        css_files.append(f)
    print(f"  扫描 {len(css_files)} 个 .wxss/.css 文件")
    cerrors = 0
    for f in css_files:
        ok_flag, msg = check_wxss(f)
        if ok_flag is False:
            rel = f.relative_to(root)
            fail(f"{rel}: {msg}")
            cerrors += 1
    if cerrors == 0:
        ok(f"全部 {len(css_files)} 个 CSS 文件通过")
    else:
        fail(f"{cerrors} 个 CSS 错误")

    # ---------- Vue ----------
    step("[5/6] Vue 文件")
    vue_dir = root / "admin-vue" / "src"
    if vue_dir.exists():
        vue_files = list(vue_dir.rglob("*.vue"))
        print(f"  扫描 {len(vue_files)} 个 .vue 文件")
        verrors = 0
        for f in vue_files:
            ok_flag, msg = check_vue(f)
            if ok_flag is False:
                rel = f.relative_to(root)
                fail(f"{rel}: {msg}")
                verrors += 1
        if verrors == 0:
            ok(f"全部 {len(vue_files)} 个 Vue 文件通过")
        else:
            fail(f"{verrors} 个 Vue 语法错误")
    else:
        warn("找不到 admin-vue/src")

    # ---------- Java ----------
    step("[6/6] Java (mvn compile)")
    if (root / "backend" / "pom.xml").exists():
        mvn = root / "backend" / "mvnw"
        if not mvn.exists():
            mvn_bin = subprocess.run(["which", "mvn"], capture_output=True, text=True)
            if mvn_bin.returncode != 0:
                warn("找不到 mvn,跳过 Java 编译")
            else:
                mvn = mvn_bin.stdout.strip()
        if isinstance(mvn, Path) and not mvn.exists():
            mvn = None
        if mvn:
            print(f"  使用: {mvn}")
            r = subprocess.run(
                [str(mvn), "-B", "-DskipTests", "compile"],
                cwd=str(root / "backend"),
                capture_output=True, text=True, timeout=180
            )
            if r.returncode == 0:
                ok(f"mvn compile BUILD SUCCESS")
            else:
                # 找具体错误
                err_lines = [l for l in r.stderr.split('\n') if 'ERROR' in l and '.java:' in l]
                for l in err_lines[:10]:
                    fail(f"mvn: {l.strip()}")
                if not err_lines:
                    fail(f"mvn compile 失败: {r.stderr[:200]}")
    else:
        warn("找不到 backend/pom.xml")

    # ---------- 总结 ----------
    print(f"\n{BLUE}══════════════════════════════{NC}")
    print(f"{BLUE}  语法检查结果{NC}")
    print(f"{BLUE}══════════════════════════════{NC}")
    print(f"{GREEN}通过: {PASS}{NC}  {YELLOW}警告: {WARN}{NC}  {RED}失败: {FAIL}{NC}")

    if FAIL == 0:
        print(f"\n{GREEN}🎉 所有语法检查通过!{NC}")
        return 0
    else:
        print(f"\n{RED}⚠️  有 {FAIL} 项失败{NC}")
        for e in ERRORS[:20]:
            print(f"  - {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
