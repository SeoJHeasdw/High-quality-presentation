#!/bin/zsh
set -e
unset ELECTRON_RUN_AS_NODE
cd /Users/jaehoseo/Desktop/vswrk/javis/rice
# 이미 떠 있으면 새로 띄우지 않고 그 창을 앞으로 가져온다(발표 중 두 번 눌러도 창이 하나다).
ELECTRON_APP="$PWD/rice-app/node_modules/electron/dist/Electron.app"
if pgrep -f "$ELECTRON_APP" >/dev/null; then
  open -a "$ELECTRON_APP"
  exit 0
fi
exec ./app.sh
