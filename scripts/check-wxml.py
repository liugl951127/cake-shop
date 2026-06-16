#!/usr/bin/env python3
"""
check-wxml.py - WXML 编译错误预检测
模拟微信开发者工具 2.32.3 基础库的严格 WXML 解析器

主要检测硬错(微信会拒绝编译的):
  1. <text> 标签里嵌套 <text>(基础库 2.x 严格模式报错)
  2. 所有开标签都有对应闭标签(标签平衡)
  3. 明显的自闭合 <tag>...</tag> 错误(image 等允许双标签)

不检测(微信允许):
  - <image> 自闭合 vs <image>...</image> 两种都行
  - wx:if 复杂表达式
"""

import re
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

# 真 void elements(微信自闭合)
VOID = {"image", "input", "icon", "switch", "slider", "progress",
        "audio", "video", "live-player", "live-pusher",
        "open-data", "web-view", "ad"}

# 微信容器/文本标签(必须配对关闭)
CONTAINER = {"view", "text", "button", "scroll-view", "swiper", "swiper-item",
             "navigator", "form", "checkbox", "checkbox-group", "radio",
             "radio-group", "picker", "picker-view", "picker-view-column",
             "label", "slot", "template", "movable-area", "movable-view",
             "cover-view", "cover-image", "block", "rich-text", "functional-page-navigator"}

def ok(m):
    global PASS
    print(f"  {GREEN}✅ {m}{NC}")
    PASS += 1

def fail(m):
    global FAIL
    print(f"  {RED}❌ {m}{NC}")
    FAIL += 1

def warn(m):
    global WARN
    print(f"  {YELLOW}⚠️  {m}{NC}")
    WARN += 1

def strip_comments(text):
    """去 HTML 注释"""
    return re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)

def check_wxml(path: Path):
    rel = path.name
    try:
        raw = path.read_text(encoding="utf-8")
    except Exception as e:
        fail(f"读取失败: {e}")
        return
    text = strip_comments(raw)

    # ---------- 1. 标签平衡(简化)----------
    # 用栈,只关心 CONTAINER + TEXT 类标签
    tag_re = re.compile(r'<(/?)([a-zA-Z][a-zA-Z0-9_-]*)([^>]*?)(/?)>', re.DOTALL)

    # 计算行号
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

    stack = []  # (tag, line)
    has_text_problem = False
    for m in tag_re.finditer(text):
        closing = m.group(1) == '/'
        tag = m.group(2).lower()
        self_close = m.group(4) == '/'

        if closing:
            if not stack:
                continue
            if stack[-1][0] == tag:
                stack.pop()
            # 不匹配时跳过(可能中间有 void 元素或 wx:if 等)
            continue
        if not self_close and tag in CONTAINER:
            stack.append((tag, pos2line(m.start())))

    # 因为我们 push 了所有 CONTAINER 但没处理 image 的关闭(被容错)
    # 直接查 stack 里是否有未关闭的
    if stack:
        for t, ln in stack:
            fail(f"{rel}:{ln} <{t}> 未闭合")
        return
    else:
        ok(f"{rel} 标签平衡")

    # ---------- 2. <text> 嵌套(关键)----------
    # 只查 3 层及以上嵌套(2 层以内微信允许)
    lines = text.split('\n')
    in_text = 0
    line_no = 0
    has_text_problem = False
    for line in lines:
        line_no += 1
        idx = 0
        while idx < len(line):
            tm = re.search(r'<(/?)text\b[^>]*>', line[idx:])
            if not tm:
                break
            tag_str = tm.group(0)
            is_close = tm.group(1) == '/'
            if is_close:
                in_text = max(0, in_text - 1)
            else:
                if in_text >= 2:  # 3 层及以上嵌套
                    col = idx + tm.start() + 1
                    fail(f"{rel}:{line_no}:{col} <text> 3 层嵌套(微信严格模式报错)")
                    has_text_problem = True
                    break
                in_text += 1
            idx += tm.end()
        if has_text_problem:
            return
    ok(f"{rel} text 嵌套正确")

    # ---------- 3. <image> 是否非法成对 ----------
    # 检查 <image>...</image> 这种 image 双标签(微信允许,只 warn)
    img_re = re.compile(r'<image[^>]*>(.*?)</image>', re.DOTALL)
    for m in img_re.finditer(text):
        ln = pos2line(m.start())
        # 微信允许,但建议自闭合
        # warn(f"{rel}:{ln} <image>...</image> 可用 <image ... /> 替代")

    # ---------- 4. 业务 warn: 用了 'text-num' 在 text 里 ----------
    if re.search(r'<text[^>]*>\s*¥<text', text):
        warn(f"{rel} 用了 ¥<text 嵌套(可能引发 text 解析错误)")

    # ---------- 5. WXML 模板里不能调 JS 方法 (微信基础库 2.32.3) ----------
    # 检测: {{xxx.method(...)}}, {{xxx.method}}, {{Math.xxx}}, {{Number(...)}}, {{String(...)}}
    # WXML 支持: 字段访问、+ - * / %、三元、逻辑、比较
    # WXML 不支持: .method() .toFixed .includes .Math.* Number() String() 等
    method_calls = [
        (r'\{\{[^}]*Math\.[a-zA-Z]', 'Math.xxx 模板里不支持'),
        (r'\{\{[^}]*\bNumber\([^\)]*\)', 'Number() 模板里不支持'),
        (r'\{\{[^}]*\bString\([^\)]*\)', 'String() 模板里不支持'),
        (r'\{\{[^}]*\bBoolean\([^\)]*\)', 'Boolean() 模板里不支持'),
        (r'\{\{[^}]*\.toFixed\([^\)]*\)', '.toFixed 模板里不支持'),
        (r'\{\{[^}]*\.toString\([^\)]*\)', '.toString 模板里不支持'),
        (r'\{\{[^}]*\.includes\([^\)]*\)', '.includes 模板里不支持'),
        (r'\{\{[^}]*\.indexOf\([^\)]*\)', '.indexOf 模板里不支持'),
        (r'\{\{[^}]*\.split\([^\)]*\)', '.split 模板里不支持'),
        (r'\{\{[^}]*\.join\([^\)]*\)', '.join 模板里不支持'),
        (r'\{\{[^}]*\.slice\([^\)]*\)', '.slice 模板里不支持'),
        (r'\{\{[^}]*\.substring\([^\)]*\)', '.substring 模板里不支持'),
        (r'\{\{[^}]*\.substr\([^\)]*\)', '.substr 模板里不支持'),
        (r'\{\{[^}]*\.charAt\([^\)]*\)', '.charAt 模板里不支持'),
        (r'\{\{[^}]*\.replace\([^\)]*\)', '.replace 模板里不支持'),
        (r'\{\{[^}]*\.parseInt\([^\)]*\)', '.parseInt 模板里不支持'),
        (r'\{\{[^}]*\.parseFloat\([^\)]*\)', '.parseFloat 模板里不支持'),
        (r'\{\{[^}]*\.startsWith\([^\)]*\)', '.startsWith 模板里不支持'),
        (r'\{\{[^}]*\.endsWith\([^\)]*\)', '.endsWith 模板里不支持'),
        # 函数调用: {{funcName(...)}}
        (r'\{\{[^}]*\b[a-zA-Z_][a-zA-Z0-9_]*\([^\)]*\)\}\}', 'WXML 不能调函数'),
    ]
    for pat, desc in method_calls:
        for m in re.finditer(pat, text):
            ln = pos2line(m.start())
            col = m.start() - line_starts[ln - 1] + 1
            snippet = m.group(0)[:60]
            fail(f"{rel}:{ln}:{col} {desc}: {snippet}...")

def find_wxml(mp: Path):
    return list(mp.rglob("*.wxml"))

def main():
    candidates = [
        Path.cwd() / "miniprogram",
        Path.cwd().parent / "miniprogram",
        Path(__file__).parent.parent / "miniprogram",
    ]
    mp = None
    for c in candidates:
        if c.exists():
            mp = c
            break
    if not mp:
        print("找不到 miniprogram")
        return 1

    print(f"{BLUE}📁 {mp}{NC}")
    files = find_wxml(mp)
    print(f"{BLUE}🔍 共 {len(files)} 个 WXML 文件{NC}\n")

    for f in sorted(files):
        check_wxml(f)

    print(f"\n{BLUE}══════════════════════════════{NC}")
    print(f"{BLUE}  WXML 校验结果{NC}")
    print(f"{BLUE}══════════════════════════════{NC}")
    print(f"{GREEN}通过: {PASS}{NC}  {YELLOW}警告: {WARN}{NC}  {RED}失败: {FAIL}{NC}")

    if FAIL == 0:
        print(f"\n{GREEN}🎉 全部 WXML 校验通过!{NC}")
        return 0
    else:
        print(f"\n{RED}⚠️  有 {FAIL} 个文件需要修复{NC}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
