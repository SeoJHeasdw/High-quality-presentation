#!/usr/bin/env bash
# 15번 책: 렌더 프레임 → 장에 들어올 때 한 번 트는 영상(seg-0.mp4)과 처음·마지막 정지 화면(a-0.jpg, a-1.jpg).
#   tools/encode-book.sh [프레임 폴더]
# 영상의 마지막 프레임과 a-1이 같아서, 영상이 끝나 멈춰도 정지 화면과 어긋나지 않는다.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=${1:-render/book/frames}
OUT=public/book
LAST=120
mkdir -p "$OUT"
ffmpeg -y -loglevel error -i "$SRC/f0000.png" -q:v 2 "$OUT/a-0.jpg"
ffmpeg -y -loglevel error -i "$SRC/f$(printf %04d $LAST).png" -q:v 2 "$OUT/a-1.jpg"
ffmpeg -y -loglevel error -framerate 30 -start_number 0 -i "$SRC/f%04d.png" -frames:v $((LAST + 1)) \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 18 -preset slow -tune film -g 30 -movflags +faststart -an "$OUT/seg-0.mp4"
ls -la "$OUT"
