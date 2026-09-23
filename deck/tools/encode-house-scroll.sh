#!/usr/bin/env bash
# 12번 스크롤 페이지: 렌더 프레임 → 스크럽용 MP4와 정지 지점 포스터(a0~a7.jpg).
#   tools/encode-house-scroll.sh [프레임 폴더]
# 스크롤로 앞뒤를 오가도 곧바로 그릴 수 있도록 키프레임 간격을 짧게, B프레임 없이 인코딩한다.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=${1:-render/house-scroll/frames}
OUT=public/house-scroll
mkdir -p "$OUT"
ffmpeg -y -loglevel error -framerate 30 -start_number 0 -i "$SRC/f%04d.png" \
  -vf "scale=1920:1080:flags=lanczos" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 20 -preset slow -tune film \
  -g 4 -keyint_min 4 -sc_threshold 0 -bf 0 -movflags +faststart -an "$OUT/film.mp4"
for i in 0 1 2 3 4 5 6 7; do
  f=$(node -e "process.stdout.write(String(require('./src/keynote/next-market/track.json').anchors[$i]))")
  ffmpeg -y -loglevel error -i "$SRC/f$(printf %04d "$f").png" -vf "scale=1920:1080:flags=lanczos" -q:v 2 "$OUT/a$i.jpg"
done
ls -la "$OUT"
