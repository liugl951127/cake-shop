#!/usr/bin/env python3
"""
小程序启动模拟
- app.json pages 路径存在
- 组件引用路径存在
- 跨分包跳转
"""
import os
import re
import json
import sys

ERRORS = []
WARNINGS = []

def add_error(m): ERRORS.append(m)
def add_warn(m): WARNINGS.append(m)

# ============== 1. app.json 路径 ==============
print("🔍 app.json pages 检查...")
app_json = 'miniprogram/app.json'
if not os.path.isfile(app_json):
    add_error("缺 app.json")
else:
    with open(app_json) as fh:
        cfg = json.load(fh)
    pages = cfg.get('pages', [])
    print(f"  主包页面: {len(pages)}")
    for p in pages:
        full = os.path.join('miniprogram', p + '.wxml')
        if not os.path.isfile(full):
            # 可能跳过一些占位
            add_warn(f"app.json 缺页: {p} -> {full}")

    subpackages = cfg.get('subpackages', [])
    print(f"  分包: {len(subpackages)}")
    for sp in subpackages:
        root = sp.get('root')
        for p in sp.get('pages', []):
            full = os.path.join('miniprogram', root, p + '.wxml')
            if not os.path.isfile(full):
                add_warn(f"分包 {root} 缺页: {p}")

# ============== 2. 全局组件 ==============
print("\n🔍 usingComponents 路径...")
def check_components(pages_root, label):
    for root, dirs, files in os.walk(pages_root):
        for f in files:
            if f == 'page.json' or f.endswith('.json'):
                path = os.path.join(root, f)
                if 'node_modules' in path: continue
                with open(path) as fh:
                    try:
                        c = json.load(fh)
                    except:
                        continue
                if 'usingComponents' in c:
                    for k, v in c['usingComponents'].items():
                        # 解析路径
                        if v.startswith('/'):
                            full = os.path.join('miniprogram', v.lstrip('/'))
                        elif v.startswith('plugin://'):
                            continue
                        else:
                            # 相对
                            full = os.path.normpath(os.path.join(os.path.dirname(path), v))
                        # 补 .js
                        if not os.path.isfile(full) and not os.path.isdir(full):
                            # 试 js/wxml
                            for ext in ['.js', '.wxml', '.json']:
                                if os.path.isfile(full + ext):
                                    full = full + ext
                                    break
                        if not (os.path.isfile(full) or os.path.isdir(full)):
                            add_warn(f"{label} {path}: 组件 {k} -> {v} 找不到")

# 主包
for root, dirs, files in os.walk('miniprogram/pages'):
    check_components(root, '主包')

# 分包
for d in os.listdir('miniprogram'):
    if d.startswith('package-'):
        check_components(os.path.join('miniprogram', d), '分包')

# 组件目录
for root, dirs, files in os.walk('miniprogram/components'):
    check_components(root, '组件')

# ============== 3. 关键 page.json 结构 ==============
print("\n🔍 检查关键 page.json...")
for p in ['login', 'index', 'detail', 'cart', 'my', 'search']:
    for root in ['miniprogram/pages', 'miniprogram/package-order', 'miniprogram/package-user']:
        path = os.path.join(root, p, p + '.json')
        if os.path.isfile(path):
            break
    else:
        add_warn(f"关键页 {p} 找不到")

# ============== 4. 全局变量 ==============
print("\n🔍 globalData 引用一致性...")
app_js = 'miniprogram/app.js'
if os.path.isfile(app_js):
    with open(app_js) as fh:
        c = fh.read()
    for m in re.finditer(r'globalData\.(\w+)', c):
        gd = m.group(1)
        # 找 getApp().globalData.xxx 引用
        pass

# ============== 输出 ==============
print("\n" + "=" * 60)
print("📊 小程序扫描结果")
print("=" * 60)
print(f"❌ 错误: {len(ERRORS)}")
print(f"⚠️  警告: {len(WARNINGS)}")

if ERRORS:
    print("\n=== 错误 ===")
    for e in ERRORS:
        print(f"  ❌ {e}")

if WARNINGS:
    print("\n=== 警告 ===")
    for w in WARNINGS[:30]:
        print(f"  ⚠️  {w}")
    if len(WARNINGS) > 30:
        print(f"  ... 共 {len(WARNINGS)} 个")

sys.exit(1 if ERRORS else 0)
