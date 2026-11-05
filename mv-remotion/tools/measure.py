"""
영상의 "느낌"을 숫자로 잰다. 고칠 곳을 감으로 찾지 않고, 전후를 숫자로 비교하려고 만든 도구.

  python3 tools/measure.py out/mv.mp4                       # 한 편
  python3 tools/measure.py ../mv/render/hiphop-mv.mp4 out/mv.mp4   # 두 편 비교(앞 = 전, 뒤 = 후)
  python3 tools/measure.py out/mv.mp4 --every 10 --sheet out/sheet.jpg  # 10초마다 + 한 장 요약

재는 것
  색      구간마다 평균 색상(hue)·채도. 3분 내내 hue가 30° 안에 있으면 "같은 색" 영화다
  명암    밝기 분포 p5/p50/p95(0~255). p50이 30 아래면 프로젝터에서 뭉개진다. p95-p5가 좁으면 탁하다
  컷      프레임 차이가 튀는 곳 = 컷. 컷 수, 길이 분포(최소/중앙/최대), 마디 배수에 몰렸는지
  움직임  프레임 간 변화량의 곡선. 평평하면 등속(화면보호기), 오르내리면 완급이 있다
"""
import argparse
import colorsys
import subprocess
import sys

import numpy as np

W, H = 96, 54


def frames(path, fps):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", f"fps={fps},scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32) / 255


def color_stats(f):
    m = f.reshape(-1, 3).mean(0)
    h, _, s = colorsys.rgb_to_hls(*m)
    lum = (f @ np.array([.2126, .7152, .0722], np.float32)) * 255
    p5, p50, p95 = np.percentile(lum, [5, 50, 95])
    return h * 360, s, p5, p50, p95


def cuts(fr, fps, bar=None):
    g = fr.mean(axis=3) * 255
    d = np.abs(np.diff(g, axis=0)).mean(axis=(1, 2))
    med = np.median(d) + 1e-6
    idx = [i + 1 for i in range(len(d)) if d[i] > max(18, med * 5) and (i == 0 or d[i] > d[i - 1] * 1.8)]
    times = [0.0] + [i / fps for i in idx] + [len(fr) / fps]
    lens = np.diff(times)
    out = {"count": len(lens), "min": lens.min(), "median": float(np.median(lens)), "max": lens.max()}
    if bar:
        mult = lens / bar
        near = np.abs(mult - np.round(mult)) < .08
        out["on_bar_multiple"] = float(near.mean())
    return out, d


def report(path, every, bar):
    print(f"\n== {path}")
    fr = frames(path, 1)
    hues = []
    print(" 시각   hue  채도  밝기 p5/p50/p95")
    for t in range(0, len(fr), every):
        h, s, p5, p50, p95 = color_stats(fr[t])
        hues.append(h)
        print(f"{t:4d}s  {h:4.0f}°  {s:.2f}   {p5:3.0f}/{p50:3.0f}/{p95:3.0f}")
    allh = [color_stats(x)[0] for x in fr]
    allp50 = [color_stats(x)[3] for x in fr]
    bins = len(set(int(h // 30) for h in allh))
    print(f" 색: hue 30° 칸 {bins}개를 지남(12칸 중) · 밝기 중앙값 범위 {min(allp50):.0f}~{max(allp50):.0f}")
    fr30 = frames(path, 15)
    c, d = cuts(fr30, 15, bar)
    extra = f" · 마디 배수 길이 비율 {c['on_bar_multiple'] * 100:.0f}%" if "on_bar_multiple" in c else ""
    print(f" 컷: {c['count']}개 · 길이 최소 {c['min']:.2f} / 중앙 {c['median']:.2f} / 최대 {c['max']:.2f}초{extra}")
    q = np.percentile(d, [10, 50, 90])
    print(f" 움직임(프레임 간 변화량): p10 {q[0]:.1f} · p50 {q[1]:.1f} · p90 {q[2]:.1f}  (p90/p50이 클수록 완급이 있다: {q[2] / max(q[1], .01):.1f}배)")
    return fr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("videos", nargs="+")
    ap.add_argument("--every", type=int, default=15, help="색·명암을 찍을 간격(초)")
    ap.add_argument("--bar", type=float, default=60 / 87.53 * 4, help="한 마디 길이(초). 컷이 마디 배수에 몰렸는지 본다")
    ap.add_argument("--sheet", default="", help="첫 영상의 --every 간격 정지 화면을 한 장으로")
    a = ap.parse_args()
    for v in a.videos:
        fr = report(v, a.every, a.bar)
    if a.sheet:
        from PIL import Image, ImageDraw
        big = frames(a.videos[0], 1 / a.every)
        ims = [Image.fromarray((x * 255).astype(np.uint8)).resize((240, 135)) for x in big]
        cols = 6
        sh = Image.new("RGB", (cols * 240, ((len(ims) + cols - 1) // cols) * 135))
        for k, im in enumerate(ims):
            ImageDraw.Draw(im).text((4, 3), f"{k * a.every}s", fill=(255, 255, 0))
            sh.paste(im, ((k % cols) * 240, (k // cols) * 135))
        sh.save(a.sheet, quality=85)
        print(f"\n정지 화면 요약: {a.sheet}")


if __name__ == "__main__":
    sys.exit(main())
