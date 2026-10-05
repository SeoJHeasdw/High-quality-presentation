#!/usr/bin/env bash
# 15번 스크롤 페이지: 렌더 프레임 → 스크럽용 MP4, 정지 지점 포스터(a0~a8.jpg), 교차로 반복 영상(street-loop.mp4).
#   tools/encode-house-scroll.sh [프레임 폴더] [반복 영상 프레임 폴더]
# 스크롤로 앞뒤를 오가도 곧바로 그릴 수 있도록 키프레임 간격을 짧게, B프레임 없이 인코딩한다.
# 반복 영상은 처음부터 끝까지 재생만 하므로 보통 간격으로 인코딩한다.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=${1:-render/house-scroll/frames}
LOOP=${2:-render/house-scroll/loop}
OUT=public/house-scroll
mkdir -p "$OUT"
ffmpeg -y -loglevel error -framerate 30 -start_number 0 -i "$SRC/f%04d.png" \
  -vf "scale=1920:1080:flags=lanczos" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 20 -preset slow -tune film \
  -g 4 -keyint_min 4 -sc_threshold 0 -bf 0 -movflags +faststart -an "$OUT/film.mp4"
i=0
for f in $(node -e "process.stdout.write(require('./src/keynote/next-market/track.json').anchors.join(' '))"); do
  ffmpeg -y -loglevel error -i "$SRC/f$(printf %04d "$f").png" -vf "scale=1920:1080:flags=lanczos" -q:v 2 "$OUT/a$i.jpg"
  i=$((i + 1))
done
ffmpeg -y -loglevel error -framerate 30 -start_number 0 -i "$LOOP/f%04d.png" \
  -vf "scale=1920:1080:flags=lanczos" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 19 -preset slow -tune film \
  -g 30 -movflags +faststart -an "$OUT/street-loop.mp4"
ls -la "$OUT"
