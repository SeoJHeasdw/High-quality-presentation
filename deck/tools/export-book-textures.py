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

# ── 펼친 면: 240·241쪽과 넘어가는 낱장 ─────────────────────────────────────
# 진짜 글자는 241쪽의 인용 한 문장(에필로그 「결국, 우리의 몫」, YES24 책 속으로 발췌)과 쪽 번호·머리글뿐이다.
# 나머지 글줄은 읽히지 않는 회색 단어 덩어리로 그려, 책에 없는 문장을 만들지 않는다. 쪽의 배치는 연출이다.
PW, PH = 1100, 1584                                            # 145 × 210mm의 낱장
SERIF = "/System/Library/Fonts/Supplemental/AppleMyungjo.ttf"
PAPER, INK, GREY = (238, 233, 222), (40, 38, 36), (150, 145, 136)
QUOTE = "몫은 기술이 우리에게 남겨주는 것이 아니라, 우리가 무엇을 맡기고 무엇을 책임질지 정하면서 만들어지는 것이다."
BODY, LEAD = 27, 47                                            # 본문 글자 크기와 줄 간격(px)

def page(right, seed, number=None, header=None, quote_at=None, scale=1):
    rnd = np.random.default_rng(seed)
    im = Image.new("RGB", (PW * scale, PH * scale), PAPER); d = ImageDraw.Draw(im, "RGBA")
    if scale != 1:
        # 같은 배치를 scale배로: 좌표계를 늘린 그리기 함수로 감싼다.
        class Scaled:
            def __init__(self, d): self.d = d
            def text(self, xy, s, font, fill): self.d.text((xy[0] * scale, xy[1] * scale), s, font=ImageFont.truetype(font.path, int(font.size * scale)), fill=fill)
            def textlength(self, s, font): return self.d.textlength(s, font=font)
            def rounded_rectangle(self, box, r, fill): self.d.rounded_rectangle([v * scale for v in box], r * scale, fill=fill)
        d = Scaled(d)
    inner, outer, top = 130, 100, 150
    x0, x1 = (inner, PW - outer) if right else (outer, PW - inner)
    body = ImageFont.truetype(SERIF, BODY); small = ImageFont.truetype(SERIF, 21)
    if header:
        w = d.textlength(header, font=small)
        d.text((x1 - w if right else x0, 88), header, font=small, fill=(*GREY, 255))
    if number:
        w = d.textlength(number, font=small)
        d.text((x1 - w if right else x0, PH - 104), number, font=small, fill=(*GREY, 255))
    lines = (PH - top - 170) // LEAD
    quote_lines = []
    if quote_at is not None:
        # 인용을 본문 폭에 맞춰 줄로 나눈다.
        words, cur = QUOTE.split(" "), ""
        for wd in words:
            test = (cur + " " + wd).strip()
            if d.textlength(test, font=body) > x1 - x0: quote_lines.append(cur); cur = wd
            else: cur = test
        quote_lines.append(cur)
    for i in range(lines):
        y = top + i * LEAD
        k = i - quote_at if quote_at is not None else -1
        if 0 <= k < len(quote_lines):
            w = d.textlength(quote_lines[k], font=body)
            d.rounded_rectangle([x0 - 8, y - 6, x0 + w + 8, y + BODY + 10], 6, fill=(242, 190, 92, 120))   # 형광펜
            d.text((x0, y), quote_lines[k], font=body, fill=(*INK, 255))
            continue
        if rnd.random() < 0.06 and i: continue                  # 문단 사이 빈 줄
        end = x1 if rnd.random() > 0.12 else x0 + (x1 - x0) * rnd.uniform(0.3, 0.8)
        x = x0 + (BODY * 1.0 if rnd.random() < 0.15 else 0)
        while x < end - 20:
            w = min(end - x, BODY * rnd.uniform(1.6, 4.4))
            h = rnd.uniform(-1.5, 1.5)
            d.rounded_rectangle([x, y + 10 + h, x + w, y + BODY - 6 + h], 2, fill=(*GREY, int(rnd.uniform(70, 105))))
            x += w + BODY * 0.42
    return im.filter(ImageFilter.GaussianBlur(0.5 * scale))

# 241쪽은 카메라가 문장 바로 위까지 내려가므로 두 배로 그린다(같은 배치를 2배 해상도로).
p241 = page(True, 241, "241", "에필로그 · 결국, 우리의 몫", quote_at=9, scale=2)
p241.save(OUT / "page-241.png")
page(False, 240, "240", "몫 : 인간의 자리").save(OUT / "page-240.png")
for i in range(4):
    page(i % 2 == 0, 300 + i).save(OUT / f"leaf-{i}.png")
print("pages", PW, PH)
