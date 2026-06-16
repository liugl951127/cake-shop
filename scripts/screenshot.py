"""
截图生成脚本
- 把 docs/architecture.html / modules.html 渲染成 PNG
- 同时生成模拟"微信开发者工具"配置步骤截图(SVG)
"""
from playwright.sync_api import sync_playwright
import os

ROOT = "/workspace/cake-shop"
DOCS = f"{ROOT}/docs"
os.makedirs(f"{DOCS}/images", exist_ok=True)

def html_to_png(html_path, png_path, width=1400, height=1800):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": width, "height": height})
        page.goto(f"file://{html_path}")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=png_path, full_page=True)
        browser.close()
    print(f"  ✅ {png_path}")

print("=== 渲染架构图 ===")
html_to_png(f"{DOCS}/architecture.html", f"{DOCS}/images/architecture.png", 1400, 2400)
print("=== 渲染模块图 ===")
html_to_png(f"{DOCS}/modules.html", f"{DOCS}/images/modules.png", 1400, 2200)
print("=== 渲染小程序配置步骤 ===")
html_to_png(f"{DOCS}/mp-setup.html", f"{DOCS}/images/mp-setup.png", 1400, 2000)
print("\n🎉 全部完成")
