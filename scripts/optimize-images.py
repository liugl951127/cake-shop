#!/usr/bin/env python3
"""
optimize-images.py - 图片压缩与清单生成

功能:
  1. 扫描 miniprogram/ 下的 PNG/JPG/JPEG/WebP
  2. 用 Pillow 重新保存 (最优化)
     - PNG: convert to RGBA + optimize=True (Zopfli)
     - JPG: quality=82 + progressive + subsampling
     - WebP: quality=80 (lossless for png)
  3. 生成 image-manifest.json (尺寸、字节、hash)
  4. 报告压缩比

用法:
  python3 scripts/optimize-images.py [--dry-run] [--webp]

为什么不用网络图片:
  - 网络图被微信沙盒服务器拦(403 Forbidden)
  - 本地图稳定 + 走缓存
"""
import argparse
import json
import os
import sys
from pathlib import Path
from PIL import Image
import hashlib

RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
BLUE = "\033[0;34m"
NC = "\033[0m"


def human_bytes(n: int) -> str:
    for u in ['B', 'KB', 'MB']:
        if n < 1024:
            return f"{n:.1f} {u}"
        n /= 1024
    return f"{n:.1f} GB"


def md5(p: Path) -> str:
    h = hashlib.md5()
    with p.open('rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


def optimize_png(src: Path, dry_run: bool) -> tuple[int, int]:
    """优化 PNG - 返回 (原大小, 新大小)"""
    orig = src.stat().st_size
    if dry_run:
        return orig, orig
    try:
        img = Image.open(src)
        # 保持 RGBA 模式
        if img.mode == 'P':
            img = img.convert('RGBA')
        elif img.mode == 'LA':
            img = img.convert('RGBA')
        # optimize=True 用 zlib 压缩
        img.save(src, format='PNG', optimize=True, compress_level=9)
        return orig, src.stat().st_size
    except Exception as e:
        print(f"  {RED}PNG 优化失败 {src}: {e}{NC}")
        return orig, orig


def optimize_jpg(src: Path, dry_run: bool) -> tuple[int, int]:
    """优化 JPG - 返回 (原大小, 新大小)"""
    orig = src.stat().st_size
    if dry_run:
        return orig, orig
    try:
        img = Image.open(src)
        if img.mode in ('RGBA', 'LA', 'P'):
            # 透明 JPG 转为白色背景
            bg = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode in ('RGBA', 'LA'):
                bg.paste(img, mask=img.split()[-1])
            else:
                bg.paste(img.convert('RGB'))
            img = bg
        img.save(src, format='JPEG', quality=82, optimize=True, progressive=True, subsampling=2)
        return orig, src.stat().st_size
    except Exception as e:
        print(f"  {RED}JPG 优化失败 {src}: {e}{NC}")
        return orig, orig


def to_webp(src: Path, dry_run: bool) -> Path | None:
    """生成 .webp 副本(不替换原文件)"""
    webp_path = src.with_suffix('.webp')
    if dry_run:
        return webp_path if webp_path.exists() else None
    try:
        img = Image.open(src)
        if src.suffix.lower() in ('.jpg', '.jpeg') and img.mode == 'RGBA':
            bg = Image.new('RGB', img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            img = bg
        # lossless for png, lossy 80 for jpg
        lossless = src.suffix.lower() == '.png'
        img.save(webp_path, format='WEBP', quality=80, lossless=lossless, method=6)
        return webp_path
    except Exception as e:
        print(f"  {RED}WebP 失败 {src}: {e}{NC}")
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='只看,不动')
    parser.add_argument('--webp', action='store_true', help='同时生成 .webp')
    parser.add_argument('--min-bytes', type=int, default=100, help='小于此字节不处理 (默认 100)')
    args = parser.parse_args()

    root = Path.cwd() / "miniprogram"
    if not root.exists():
        root = Path(__file__).parent.parent / "miniprogram"

    # 找图片
    patterns = ['**/*.png', '**/*.jpg', '**/*.jpeg']
    files = []
    for p in patterns:
        for f in root.rglob(p):
            if any(x in str(f) for x in ('node_modules', '__pycache__')):
                continue
            files.append(f)
    files = sorted(set(files))

    print(f"{BLUE}📁 扫描 {len(files)} 个图片{NC}")
    if args.dry_run:
        print(f"  {YELLOW}(dry-run 模式,不会修改文件){NC}\n")
    print()

    total_orig = 0
    total_new = 0
    webp_total = 0
    manifest = []
    skipped = 0

    for src in files:
        rel = src.relative_to(root)
        if src.stat().st_size < args.min_bytes:
            skipped += 1
            continue

        # 优化
        if src.suffix.lower() == '.png':
            orig, new = optimize_png(src, args.dry_run)
        else:
            orig, new = optimize_jpg(src, args.dry_run)
        total_orig += orig
        total_new += new

        # WebP
        webp_size = 0
        webp_path = None
        if args.webp:
            wp = to_webp(src, args.dry_run)
            if wp and wp.exists():
                webp_size = wp.stat().st_size
                webp_path = str(wp.relative_to(root))
                webp_total += webp_size

        # 缩略图信息
        try:
            with Image.open(src) as img:
                w, h = img.size
                mode = img.mode
        except Exception:
            w, h, mode = 0, 0, '?'

        ratio = (1 - new / orig) * 100 if orig else 0
        color = GREEN if ratio > 0 else (YELLOW if ratio == 0 else RED)
        sign = '↓' if ratio > 0 else ('=' if ratio == 0 else '↑')
        print(f"  {color}{rel}  {w}x{h} {mode}  {human_bytes(orig)} → {human_bytes(new)}  {sign} {abs(ratio):.1f}%{NC}")

        manifest.append({
            "path": str(rel),
            "size": [w, h],
            "mode": mode,
            "bytes": new,
            "md5": md5(src) if not args.dry_run else None,
            "webp": webp_path,
            "webpBytes": webp_size if webp_path else None
        })

    # 写清单
    if not args.dry_run and manifest:
        mpath = root / "images" / "image-manifest.json"
        mpath.parent.mkdir(parents=True, exist_ok=True)
        with mpath.open('w', encoding='utf-8') as f:
            json.dump({
                "version": 1,
                "total": len(manifest),
                "skipped": skipped,
                "totalBytes": total_new,
                "images": manifest
            }, f, indent=2, ensure_ascii=False)
        print(f"\n  {GREEN}✅ image-manifest.json 已写入 ({len(manifest)} 项){NC}")

    # 总结
    print(f"\n{BLUE}══════════════════════════════{NC}")
    print(f"  处理: {len(manifest)} 个 (跳过 {skipped} 个 < {args.min_bytes}B)")
    print(f"  原始: {human_bytes(total_orig)}")
    print(f"  优化: {human_bytes(total_new)}  ({total_orig - total_new:+d} B)")
    if total_orig:
        ratio = (1 - total_new / total_orig) * 100
        print(f"  压缩比: {ratio:+.1f}%")
    if args.webp and webp_total:
        print(f"  WebP 副本: {human_bytes(webp_total)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
