# 31번 Assets Engine 실물: 2026년 10월 실제 출력으로 15초 릴을 만든다(여우 영상 → 달빛 야시장 3D 소품 32개 → 건축 키트·나무·지형).
import os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
J = "/Users/jaehoseo/Desktop/vswrk/javis/local-assets-engine/output/jobs"
OUT = sys.argv[1]; TMP = sys.argv[2]
FONT = "/Users/jaehoseo/Desktop/vswrk/edu/tel_edu_javis/opus-site/public/fonts/PretendardVariable.woff2"
W, H, BG = 1280, 720, (9, 13, 19)
def font(size, weight):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([weight])
    except Exception: pass
    return f
def caption(img, title, sub):
    # 장표 아래의 출처 띠(영상 높이의 약 1/12)에 가리지 않게 글을 그 위로 올린다. 날짜는 장표 띠에 있으니 넣지 않는다.
    d = ImageDraw.Draw(img)
    shade = Image.new("RGBA", (W, 280), (0, 0, 0, 0)); sd = ImageDraw.Draw(shade)
    for y in range(280): sd.line([(0, y), (W, y)], fill=(5, 8, 12, int(240 * min(1, y / 170))))
    img.alpha_composite(shade, (0, H - 280))
    d.text((48, H - 150), title, font=font(34, 640), fill=(244, 240, 232, 255))
    d.text((48, H - 104), sub, font=font(19, 450), fill=(176, 190, 202, 255))
def rounded(im, r):
    m = Image.new("L", im.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], r, fill=255); im.putalpha(m); return im
# A · 여우 영상 위의 자막(투명 PNG)
a = Image.new("RGBA", (W, H), (0, 0, 0, 0)); caption(a, "영상", "설명 한 줄 → 5초 영상 · a red fox in a snowy pine forest"); a.save(f"{TMP}/capA.png")
# B · 달빛 야시장 3D 소품 32개
mk = f"{J}/20261022-105559-24d6/market"
names = sorted(f for f in os.listdir(mk) if f.startswith("preview_"))
b = Image.new("RGBA", (W, H), BG + (255,)); t, g = 118, 9
x0 = (W - (8 * t + 7 * g)) // 2; y0 = 28
for i, n in enumerate(names[:32]):
    im = Image.open(f"{mk}/{n}").convert("RGBA").resize((t, t), Image.LANCZOS)
    b.alpha_composite(rounded(im, 12), (x0 + (i % 8) * (t + g), y0 + (i // 8) * (t + g)))
caption(b, "3D 소품 32개", "달빛 야시장 수공예 에셋 키트 · 게임 엔진용 FBX · GLB"); b.convert("RGB").save(f"{TMP}/B.png")
# C · 건축 키트, 나무, 지형 질감. review.png의 왼쪽 위 사진(x 0–1000)은 엔진에 준 참고 이미지라 잘라 내고, 엔진이 렌더한 오두막과 조각만 쓴다.
c = Image.new("RGBA", (W, H), BG + (255,))
rv = Image.open(f"{J}/20261016-214739-8e8d/kit/review.png").convert("RGBA")
house = rv.crop((1000, 0, 2600, 1000)).resize((480, 300), Image.LANCZOS)
pieces = rv.crop((0, 1010, 2600, 2040)).resize((480, 190), Image.LANCZOS)
c.alpha_composite(rounded(house, 14), (118, 28)); c.alpha_composite(rounded(pieces, 14), (118, 340))
tr = Image.open(f"{J}/20261017-153730-2e4d/tree/hero.png").convert("RGBA"); tr = tr.crop((0, 30, 900, 447)).resize((540, 250), Image.LANCZOS)
c.alpha_composite(rounded(tr, 14), (612, 28))
te = Image.open(f"{J}/20261017-050719-f403/terrain/preview.png").convert("RGBA"); te = te.crop((0, 0, 1440, 640)).resize((540, 240), Image.LANCZOS)
c.alpha_composite(rounded(te, 14), (612, 290))
caption(c, "건축 키트 · 나무 · 지형 질감", "벽 · 문 · 지붕 · 계단 조각과 전나무, 들판 질감 · 게임 월드 재료"); c.convert("RGB").save(f"{TMP}/C.png")
fox = f"{J}/20261019-132517-be02/video/video.mp4"
DA, DS, X = 5.04, 5.3, 0.5
fc = (f"[0:v]scale=1309:720,crop={W}:{H},fps=30,setsar=1[f];[f][3:v]overlay=0:0,format=yuv420p[a];"
      f"[1:v]scale=2560:1440,zoompan=z='1+0.035*on/{int(DS*30)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps=30,format=yuv420p,setsar=1[b];"
      f"[2:v]scale=2560:1440,zoompan=z='1+0.035*on/{int(DS*30)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps=30,format=yuv420p,setsar=1[c];"
      f"[a][b]xfade=transition=fade:duration={X}:offset={DA - X}[ab];[ab][c]xfade=transition=fade:duration={X}:offset={DA + DS - 2 * X}[v]")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", fox, "-loop", "1", "-t", str(DS), "-framerate", "30", "-i", f"{TMP}/B.png",
                "-loop", "1", "-t", str(DS), "-framerate", "30", "-i", f"{TMP}/C.png", "-i", f"{TMP}/capA.png",
                "-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", f"{OUT}.mp4"], check=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1.2", "-i", f"{OUT}.mp4", "-frames:v", "1", "-q:v", "3", f"{OUT}.jpg"], check=True)
print("ok")
