#!/usr/bin/env python3
"""Keynote 15 · 책의 책등과 금박 자리를 표지 파일에서 만든다(tools/render-book.py가 쓴다).

책등은 발표자가 찍은 실물 사진(2026-10-26)의 배치를 따른다: 위에 데이터 격자, "몫", "인간의 자리"를 한 글자씩 세로로,
가는 줄, "행동하는 AI 시대", "백승헌 지음". "몫"과 "인간의 자리"는 표지에서 그 글자를 오려 쓰고, 나머지는 Apple SD 산돌고딕 Neo로 쓴다.
출판사 로고는 그리지 않는다. 금박은 실물에서 빛을 되받던 "인간의 자리"만이다.

  python3 tools/export-book-textures.py      # render/book/spine.png, render/book/foil.png
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "render/book"
OUT.mkdir(parents=True, exist_ok=True)
cover = Image.open(ROOT / "public/book/cover.jpg").convert("RGB")
C = np.asarray(cover).astype(np.float32) / 255
r, g, b = C[..., 0], C[..., 1], C[..., 2]
L = 0.2126 * r + 0.7152 * g + 0.0722 * b
WARM = (r > b + 0.08) & (L > 0.35)
WHITE = (L > 0.8) & (np.abs(r - b) < 0.08)
FONT = "/System/Library/Fonts/AppleSDGothicNeo.ttc"

# ── 금박: 제목 "인간의 자리" ─────────────────────────────────────────────
foil = np.zeros(L.shape, np.uint8)
foil[335:560, 395:700] = WARM[335:560, 395:700] * 255
Image.fromarray(foil).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.6)).save(OUT / "foil.png")

# ── 책등: 표지와 같은 축척(세로 1200 = 210mm)의 2배로 그린다 ─────────────────
K = 2
H, Wd = 1200 * K, round(1200 * 20 / 210) * K          # 두께 20mm
BG = (8, 9, 16)
sp = Image.new("RGB", (Wd, H), BG)

def glyph(box, mask, height, at_y):
    """표지에서 box 안의 글자(mask)를 오려 높이 height(1200 축척)로 줄여 가운데에 놓는다."""
    x0, y0, x1, y1 = box
    m = mask[y0:y1, x0:x1]
    ys, xs = np.nonzero(m)
    x0, x1, y0, y1 = x0 + xs.min(), x0 + xs.max() + 1, y0 + ys.min(), y0 + ys.max() + 1
    crop = cover.crop((x0, y0, x1, y1))
    alpha = Image.fromarray((mask[y0:y1, x0:x1] * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
    s = height * K / (y1 - y0)
    size = (max(1, round((x1 - x0) * s)), max(1, round((y1 - y0) * s)))
    crop, alpha = crop.resize(size, Image.LANCZOS), alpha.resize(size, Image.LANCZOS)
    sp.paste(crop, ((Wd - size[0]) // 2, round(at_y * K)), alpha)

# 위의 데이터 격자: 표지 왼쪽 위에서 책등 폭만큼 오려 아래로 흐려지게 둔다.
grid = cover.crop((22, 130, 22 + Wd // K, 250)).resize((Wd, 120 * K), Image.LANCZOS)
fade = Image.linear_gradient("L").rotate(180).resize((Wd, 120 * K))
sp.paste(grid, (0, 0), fade)

glyph((128, 285, 396, 610), WHITE, 56, 128)                      # 몫
for i, box in enumerate([(405, 340, 494, 442), (504, 340, 600, 442), (602, 340, 692, 442), (404, 452, 501, 552), (507, 452, 595, 552)]):
    glyph(box, WARM, 46, 196 + i * 53)                           # 인 간 의 자 리

d = ImageDraw.Draw(sp, "RGBA")
beige = tuple(int(v * 255) for v in C[990, 300]) if WARM[990, 300] else (226, 200, 176)
d.line([(Wd * 0.2, 466 * K), (Wd * 0.8, 466 * K)], fill=(*beige, 210), width=K)

# 부제 뒤로 지나가는 파란 빛줄기(실물 책등의 그 자리).
glow = Image.new("L", (Wd, H), 0)
ImageDraw.Draw(glow).rectangle([0, 548 * K, Wd, 600 * K], fill=90)
glow = glow.filter(ImageFilter.GaussianBlur(26 * K))
sp.paste(Image.new("RGB", (Wd, H), (46, 104, 220)), (0, 0), glow)

def stack(chars, font, size, color, y0, pitch):
    f = ImageFont.truetype(FONT, size * K, index=font)
    y = y0
    for ch in chars:
        if ch != " ":
            l, t, rr, bb = d.textbbox((0, 0), ch, font=f)
            d.text(((Wd - (rr - l)) / 2 - l, y * K - t), ch, font=f, fill=color)
        y += pitch

stack("행동하는 AI 시대", 6, 21, beige, 490, 23)               # Bold
stack("백승헌 지음", 0, 16, (196, 198, 206), 742, 22)           # Regular
sp.save(OUT / "spine.png")
print("spine", sp.size, "foil", foil.shape, "beige", beige)
