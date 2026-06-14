#!/usr/bin/env python3
"""SSR + admin-h5 启动模拟"""
import os, json, re, sys

ERRORS = []
WARNINGS = []
def add_error(m): ERRORS.append(m)
def add_warn(m): WARNINGS.append(m)

# ============== 1. SSR ==============
print("🔍 SSR 检查...")
ssr_pkg = 'ssr/package.json'
if os.path.isfile(ssr_pkg):
    with open(ssr_pkg) as fh:
        p = json.load(fh)
    deps = list(p.get('dependencies', {}).keys())
    print(f"  依赖: {len(deps)}")
    # 检查关键依赖
    for need in ['koa', 'ejs', 'axios']:
        if need not in deps:
            add_warn(f"SSR 缺依赖: {need}")

# ============== 2. admin-h5 ==============
print("\n🔍 admin-h5 检查...")
adm = 'admin-h5'
if os.path.isdir(adm):
    # 检查关键文件
    for f in ['css/theme.css', 'css/layout.css', 'js/app.js', 'js/request.js', 'js/router.js']:
        if not os.path.isfile(os.path.join(adm, f)):
            add_error(f"admin-h5 缺: {f}")
    # 检查所有 HTML 引用的资源
    for root, dirs, files in os.walk(adm):
        for f in files:
            if f.endswith('.html'):
                p = os.path.join(root, f)
                with open(p) as fh:
                    content = fh.read()
                # 找 /css/xxx.css /js/xxx.js
                for m in re.finditer(r'(?:href|src)="(/[^"]+)"', content):
                    res = m.group(1)
                    # classpath: 是后端的,跳过
                    if res.startswith('classpath:'): continue
                    if res.startswith('http'): continue
                    if res.startswith('pages/'): continue
                    if res.startswith('//'): continue
                    full = os.path.join(adm, res.lstrip('/'))
                    if not os.path.isfile(full):
                        # 试加 index.html
                        if not os.path.isfile(full + '/index.html'):
                            add_warn(f"{p} 引用 {res} 找不到")

# ============== 输出 ==============
print("\n" + "=" * 60)
print("📊 前端扫描结果")
print("=" * 60)
print(f"❌ 错误: {len(ERRORS)}")
print(f"⚠️  警告: {len(WARNINGS)}")
if ERRORS:
    for e in ERRORS[:20]: print(f"  ❌ {e}")
if WARNINGS:
    for w in WARNINGS[:20]: print(f"  ⚠️  {w}")
sys.exit(1 if ERRORS else 0)
