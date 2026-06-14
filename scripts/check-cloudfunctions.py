#!/usr/bin/env python3
"""
云函数启动模拟
- 检查 require 引用是否都存在
- 检查 package.json 完整性
- 检查 server-sdk 用法是否正确
"""
import os
import re
import sys
import json
from collections import defaultdict

CFDIR = 'cloudfunctions'
ERRORS = []
WARNINGS = []
INFOS = []

def add_error(msg): ERRORS.append(msg)
def add_warn(msg): WARNINGS.append(msg)
def add_info(msg): INFOS.append(msg)

# 收集所有云函数
cf_list = []
for d in os.listdir(CFDIR):
    full = os.path.join(CFDIR, d)
    if os.path.isdir(full) and not d.startswith('.'):
        cf_list.append(d)
print(f"📁 云函数目录: {len(cf_list)}")

# ============== 1. 公共模块 ==============
common_dir = os.path.join(CFDIR, 'common')
common_modules = {}
if os.path.isdir(common_dir):
    for f in os.listdir(common_dir):
        if f.endswith('.js'):
            common_modules[f] = os.path.join(common_dir, f)
print(f"📦 common 模块: {len(common_modules)}")

# ============== 2. 每个云函数的依赖 ==============
required = defaultdict(set)  # cf -> set of required modules
missing = []

for cf in cf_list:
    cf_dir = os.path.join(CFDIR, cf)
    idx = os.path.join(cf_dir, 'index.js')
    if not os.path.isfile(idx):
        add_warn(f"云函数 {cf} 缺 index.js")
        continue
    pkg = os.path.join(cf_dir, 'package.json')
    if not os.path.isfile(pkg):
        add_warn(f"云函数 {cf} 缺 package.json")
    else:
        try:
            with open(pkg) as fh:
                pj = json.load(fh)
            if 'wx-server-sdk' not in pj.get('dependencies', {}):
                add_warn(f"{cf}/package.json 缺 wx-server-sdk")
        except Exception as e:
            add_error(f"{cf}/package.json JSON 错: {e}")

    # 找 require
    with open(idx) as fh:
        content = fh.read()
    # 简化注释
    content = re.sub(r'//.*', '', content)
    # 找 require('../common/xxx') 或 require('../common/xxx.js')
    for m in re.finditer(r"require\(['\"]\.\./common/(\w+?)(?:\.js)?['\"]\)", content):
        mod = m.group(1) + '.js'
        required[cf].add(mod)
        if mod not in common_modules:
            missing.append((cf, mod))

print(f"\n🔍 跨云函数 common 引用: {sum(len(v) for v in required.values())} 处")
if missing:
    add_error(f"缺失 common 模块: {missing[:10]}")

# ============== 3. common 模块内部 require ==============
print("\n🔍 common 模块内部引用...")
for fname, fpath in common_modules.items():
    with open(fpath) as fh:
        content = fh.read()
    deps = []
    for m in re.finditer(r"require\(['\"]\.?/(\w+?)(?:\.js)?['\"]\)", content):
        deps.append(m.group(1) + '.js')
    # 找 ../ 引用
    for m in re.finditer(r"require\(['\"]\.\./(\w+?)/(\w+?)(?:\.js)?['\"]\)", content):
        deps.append(f"{m.group(1)}/{m.group(2)}.js")
    # 找 ./X.js
    for m in re.finditer(r"require\(['\"]\./(\w+?)\.js['\"]\)", content):
        deps.append(m.group(1) + '.js')
    if deps:
        for d in deps:
            if d == 'index.js':
                continue
            if d.startswith('cache.') or d.startswith('logger.') or d.startswith('errors.') or d.startswith('formatTime.') or d.startswith('index.'):
                continue
            # 校验
            if d.endswith('.js') and '/' not in d:
                # 同目录
                full = os.path.join(common_dir, d)
                if not os.path.isfile(full):
                    # 可能没写 .js 后缀
                    base = d.replace('.js', '')
                    if os.path.isfile(os.path.join(common_dir, base + '.js')):
                        continue
                    add_error(f"common/{fname} require '{d}' 找不到")

# ============== 4. 入口文件 exports.main ==============
print("\n🔍 检查 exports.main ...")
no_main = []
for cf in cf_list:
    idx = os.path.join(CFDIR, cf, 'index.js')
    if not os.path.isfile(idx): continue
    with open(idx) as fh:
        c = fh.read()
    if 'exports.main' not in c and 'module.exports.main' not in c:
        no_main.append(cf)
if no_main:
    add_warn(f"无 exports.main: {no_main[:5]}")

# ============== 5. wx-server-sdk 用法检查 ==============
print("\n🔍 wx-server-sdk 用法...")
for cf in cf_list:
    idx = os.path.join(CFDIR, cf, 'index.js')
    if not os.path.isfile(idx): continue
    with open(idx) as fh:
        content = fh.read()
    # 必须有 cloud.database() / cloud.getWXContext()
    if 'cloud.getWXContext' not in content and 'wxContext' not in content:
        # 不是必须的(纯配置)
        pass
    # 检查 cloud. 调用
    if re.search(r'\bcloud\.', content):
        # 应该 require('wx-server-sdk')
        if "require('wx-server-sdk')" not in content and 'require("wx-server-sdk")' not in content:
            add_warn(f"{cf} 用 cloud. 但未 require('wx-server-sdk')")

# ============== 6. 错误码 import 路径 ==============
print("\n🔍 错误码引用...")
errs_required = 0
errs_in_common = 0
for cf in cf_list:
    idx = os.path.join(CFDIR, cf, 'index.js')
    if not os.path.isfile(idx): continue
    with open(idx) as fh:
        content = fh.read()
    if 'BizError' in content or 'ErrorCode' in content:
        if "../common/errors.js" not in content:
            add_warn(f"{cf} 用 BizError/ErrorCode 但未 require common/errors.js")

# ============== 7. common 包 package.json ==============
print("\n🔍 common/package.json...")
common_pkg = os.path.join(common_dir, 'package.json')
if os.path.isfile(common_pkg):
    with open(common_pkg) as fh:
        c = json.load(fh)
    if 'name' not in c:
        add_error("common/package.json 缺 name")
    if 'main' not in c:
        add_error("common/package.json 缺 main")
    if 'dependencies' not in c:
        add_warn("common/package.json 缺 dependencies")
    print(f"  name: {c.get('name', 'N/A')}")
    print(f"  main: {c.get('main', 'N/A')}")
    print(f"  dependencies: {list(c.get('dependencies', {}).keys())}")

# ============== 输出 ==============
print("\n" + "=" * 60)
print("📊 云函数扫描结果")
print("=" * 60)
print(f"❌ 错误: {len(ERRORS)}")
print(f"⚠️  警告: {len(WARNINGS)}")
print(f"ℹ️  提示: {len(INFOS)}")

if ERRORS:
    print("\n=== 错误 ===")
    for e in ERRORS[:30]:
        print(f"  ❌ {e}")

if WARNINGS:
    print("\n=== 警告 ===")
    for w in WARNINGS[:30]:
        print(f"  ⚠️  {w}")

sys.exit(1 if ERRORS else 0)
