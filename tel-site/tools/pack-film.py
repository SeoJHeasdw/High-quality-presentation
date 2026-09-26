#!/usr/bin/env python3
"""낱장 WebP 프레임(render/film/webp/<해상도>/f0000.webp …)을 불러오는 순서대로 묶는다.

페이지는 16칸마다 → 8 → 4 → 2 → 1칸의 순서로 프레임을 받는다(첫 묶음만 오면 열린다).
그 순서 그대로 묶음 다섯 개(pass0.bin~pass4.bin)와 위치표(index.json)를 만든다.
저장소에 1,362개의 낱장 대신 해상도마다 파일 여섯 개만 남는다.

  python3 tools/pack-film.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "render/film/webp"
OUT = ROOT / "public/film"
TOTAL = 681
PASSES = [16, 8, 4, 2, 1]

groups, seen = [], set()
for step in PASSES:
    g = [i for i in range(0, TOTAL, step) if i not in seen]
    seen.update(g)
    if TOTAL - 1 not in seen:
        g.append(TOTAL - 1); seen.add(TOTAL - 1)
    groups.append(g)
assert len(seen) == TOTAL

for res in ("1920", "1280"):
    out = OUT / res
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("f*.webp"):
        old.unlink()
    index = {"frames": TOTAL, "type": "image/webp", "packs": []}
    for p, g in enumerate(groups):
        name, off, entries = f"pass{p}.bin", 0, []
        with open(out / name, "wb") as fo:
            for i in g:
                b = (SRC / res / f"f{i:04d}.webp").read_bytes()
                fo.write(b)
                entries.append([i, off, len(b)])
                off += len(b)
        index["packs"].append({"file": name, "bytes": off, "frames": entries})
    (out / "index.json").write_text(json.dumps(index, separators=(",", ":")))
    print(res, [f"{len(g)} frames/{pk['bytes'] / 1e6:.1f} MB" for g, pk in zip(groups, index["packs"])])
