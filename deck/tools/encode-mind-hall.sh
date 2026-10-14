#!/usr/bin/env bash
# 43~46번 전시관: 렌더 프레임 → 정지 지점 사이 조각(seg-k.mp4)과 정지 화면(a-k.jpg).
#   tools/encode-mind-hall.sh [프레임 폴더]
# 조각 k는 정지 지점 k의 프레임에서 k+1의 프레임까지(양 끝 포함)라, 끝난 뒤 보이는 정지 화면 a-(k+1)과 마지막 프레임이 같다.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=${1:-render/mind-hall/frames}
OUT=public/mind-hall
mkdir -p "$OUT"
read -r -a A <<< "$(node -e "process.stdout.write(require('./src/keynote/mind/hall.json').anchors.join(' '))")"
for ((k = 0; k < ${#A[@]}; k++)); do
  ffmpeg -y -loglevel error -i "$SRC/f$(printf %04d "${A[$k]}").png" -q:v 2 "$OUT/a-$k.jpg"
  if ((k + 1 < ${#A[@]})); then
    n=$((A[k + 1] - A[k] + 1))
    ffmpeg -y -loglevel error -framerate 30 -start_number "${A[$k]}" -i "$SRC/f%04d.png" -frames:v "$n" \
      -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 19 -preset slow -tune film -g 30 -movflags +faststart -an "$OUT/seg-$k.mp4"
  fi
done
ls -la "$OUT"
