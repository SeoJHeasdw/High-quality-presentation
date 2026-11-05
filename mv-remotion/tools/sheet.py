"""정지 화면 여러 장을 한 장으로(4열). 왼쪽 위에 파일 이름의 시각을 적는다.  python3 tools/sheet.py out.jpg a.jpg b.jpg ..."""
import sys, re
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert("RGB") for f in files]
w = 640; h = int(ims[0].height * w / ims[0].width)
cols = min(4, len(ims)); rows = (len(ims) + cols - 1) // cols
sh = Image.new("RGB", (cols * w, rows * h), (20, 20, 20))
for k, (im, f) in enumerate(zip(ims, files)):
    im = im.resize((w, h))
    m = re.search(r"t([\d.]+)\.jpg$", f)
    ImageDraw.Draw(im).text((8, 6), (m.group(1) + "s") if m else f, fill=(255, 255, 0))
    sh.paste(im, ((k % cols) * w, (k // cols) * h))
sh.save(out, quality=85)
print(out)
