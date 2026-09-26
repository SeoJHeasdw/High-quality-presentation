#!/usr/bin/env bash
# 렌더한 PNG(2560×1440) → 스크롤용 WebP(1920·1280) → 불러오는 순서대로 묶음(tools/pack-film.py),
# 그리고 장마다의 정지 이미지(a0~a7.jpg).
#   tools/encode-film.sh            이미 만든 낱장은 건너뛴다(렌더 중에도 여러 번 돌릴 수 있다)
# 낱장 WebP는 render/film/webp/(Git 제외)에 두고, 저장소에는 묶음만 들어간다.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=render/film/frames
OUT=render/film/webp
PUB=public/film
mkdir -p "$OUT/1920" "$OUT/1280" "$PUB/poster"
enc() {
  f="$1"; n=$(basename "$f" .png)
  [ -s "$f" ] || exit 0
  [ -s "$OUT/1920/$n.webp" ] || cwebp -quiet -q 74 -m 5 -sharp_yuv -resize 1920 1080 "$f" -o "$OUT/1920/$n.webp"
  [ -s "$OUT/1280/$n.webp" ] || cwebp -quiet -q 70 -m 5 -sharp_yuv -resize 1280 720 "$f" -o "$OUT/1280/$n.webp"
}
export -f enc; export OUT
find "$SRC" -name "f*.png" -size +100k | sort | xargs -P 8 -I{} bash -c 'enc "$@"' _ {}
i=0
for f in 0 96 192 300 408 500 590 680; do
  png=$(printf "%s/f%04d.png" "$SRC" "$f")
  if [ -s "$png" ]; then ffmpeg -y -loglevel error -i "$png" -vf "scale=1920:1080:flags=lanczos" -q:v 3 "$PUB/poster/a$i.jpg"; fi
  i=$((i+1))
done
echo "1920: $(ls $OUT/1920 | wc -l) frames, $(du -sh $OUT/1920 | cut -f1)  ·  1280: $(du -sh $OUT/1280 | cut -f1)"
[ "$(ls $OUT/1920 | wc -l | tr -d ' ')" -ge 681 ] && python3 tools/pack-film.py
