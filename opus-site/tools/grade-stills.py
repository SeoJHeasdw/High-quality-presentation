#!/usr/bin/env python3
"""프로젝트 사진 마감: 렌더 PNG(2560×1440) → 1920 JPG.
사진처럼 보이도록 부드러운 S 커브, 그림자는 차갑게·밝은 곳은 따뜻하게(스플릿 톤), 가장자리 비네트, 아주 약한 입자.
  python3 tools/grade-stills.py render/film/shots public/projects
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)
for p in sorted(src.glob("*.png")):
    im = Image.open(p).convert("RGB").resize((1920, 1080), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255.0
    # S 커브(중간 대비를 조금 올리고 끝은 부드럽게)
    a = a + .08 * np.sin(np.pi * (a - .5)) * (a * (1 - a)) * 4
    lum = (a @ np.array([.2126, .7152, .0722], np.float32))[..., None]
    shadow = np.clip(1 - lum * 2.2, 0, 1) ** 1.5
    high = np.clip((lum - .55) * 2.2, 0, 1)
    a = a + shadow * np.array([-.006, .004, .018], np.float32) + high * np.array([.02, .008, -.016], np.float32)
    # 비네트
    h, w = lum.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    a = a * (1 - .22 * np.clip(r - .55, 0, 1) ** 1.6)[..., None]
    # 입자
    a = a + rng.normal(0, .006, a.shape[:2])[..., None].astype(np.float32)
    out = Image.fromarray((np.clip(a, 0, 1) * 255 + .5).astype(np.uint8))
    out.save(dst / (p.stem + ".jpg"), quality=88, optimize=True, progressive=True)
    print("graded", p.name)
