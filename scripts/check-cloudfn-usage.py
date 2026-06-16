#!/usr/bin/env python3
"""
check-cloudfn-usage.py - 分析云函数使用情况
快速版: 一次扫描,逐个云函数匹配
"""
import re
import sys
from pathlib import Path
from collections import defaultdict

RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
BLUE = "\033[0;34m"
NC = "\033[0m"


def main():
    root = Path.cwd()
    if not (root / "cloudfunctions").exists():
        root = Path(__file__).parent.parent

    cf_dir = root / "cloudfunctions"
    fns = sorted([d.name for d in cf_dir.iterdir() if d.is_dir() and d.name != "common"])

    # 一次扫所有源文件,按云函数名建索引
    # name: 'xxx' 或 name="xxx"
    pattern = re.compile(r"name\s*[:=]\s*['\"]([a-zA-Z][a-zA-Z0-9_-]*)['\"]")

    name_to_files = defaultdict(set)

    # 1. 扫 miniprogram
    print(f"{BLUE}📁 扫描 miniprogram/...{NC}")
    mp_js = list((root / "miniprogram").rglob("*.js"))
    for js in mp_js:
        try:
            content = js.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for m in pattern.finditer(content):
            name_to_files[m.group(1)].add(str(js.relative_to(root)))

    # 2. 扫 cloudfunctions (非 common)
    print(f"{BLUE}📁 扫描 cloudfunctions/...{NC}")
    cf_js = []
    for d in cf_dir.iterdir():
        if d.is_dir() and d.name != "common":
            cf_js.extend(d.rglob("*.js"))
    for js in cf_js:
        try:
            content = js.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for m in pattern.finditer(content):
            name_to_files[m.group(1)].add(str(js.relative_to(root)))

    print()
    print(f"{BLUE}📊 云函数使用分析{NC}")
    print(f"{BLUE}═══════════════════════════{NC}\n")
    print(f"  总云函数: {len(fns)}")

    unused = []
    single_use = []
    multi_use = []

    for fn in fns:
        callers = name_to_files.get(fn, set())
        # 排除自己引用自己(比如自身 name 在 index.js 里出现)
        callers_self = {c for c in callers if "/cloudfunctions/" + fn + "/" in c}
        callers = callers - callers_self

        if not callers:
            unused.append(fn)
        elif len(callers) == 1:
            single_use.append((fn, list(callers)[0]))
        else:
            multi_use.append((fn, len(callers)))

    print(f"  {GREEN}多处引用 (核心): {len(multi_use)}{NC}")
    print(f"  {YELLOW}仅 1 处引用:    {len(single_use)}{NC}")
    print(f"  {RED}未使用:          {len(unused)}{NC}\n")

    if unused:
        print(f"{RED}=== ⚠️  未被任何代码引用的云函数 ==={NC}")
        # 分类
        sys_cloudfn = [f for f in unused if f.startswith("auto") or f in ("warmup", "logAccess", "initData", "initCms", "initCoupons", "initGroup", "initPromos", "initRegions", "initSeckill", "initSkillGroups", "initStores")]
        admin_cf = [f for f in unused if f.startswith("admin")]
        other = [f for f in unused if f not in sys_cloudfn and f not in admin_cf]
        if sys_cloudfn:
            print(f"  {YELLOW}[系统定时任务 - 需保留] {len(sys_cloudfn)} 个:{NC}")
            for f in sys_cloudfn: print(f"    - {f}")
        if admin_cf:
            print(f"  {YELLOW}[后台管理 - 需保留] {len(admin_cf)} 个:{NC}")
            for f in admin_cf: print(f"    - {f}")
        if other:
            print(f"  {RED}[可清理] {len(other)} 个:{NC}")
            for f in other: print(f"    - {f}")
        print()

    if single_use:
        print(f"{YELLOW}=== 仅 1 处引用 ==={NC}")
        for fn, c in single_use[:30]:
            print(f"  - {fn}  ←  {c}")
        if len(single_use) > 30:
            print(f"  ... +{len(single_use) - 30} more")
        print()

    print(f"{GREEN}=== 核心云函数 (多处引用) ==={NC}")
    for fn, n in sorted(multi_use, key=lambda x: -x[1])[:30]:
        print(f"  - {fn}  ({n} 处)")
    if len(multi_use) > 30:
        print(f"  ... +{len(multi_use) - 30} more")

    return 0


if __name__ == "__main__":
    sys.exit(main())
