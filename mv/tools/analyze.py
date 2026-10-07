"""
뮤비 시안(mv/src)이 쓰는 곡 분석. 화면은 이 JSON만 보고 그리므로, 같은 시각이면 언제 그려도 같은 그림이 나온다.

  python3 tools/analyze.py                                   # 감성 힙합 초안 (mv/ 안에서)
  python3 tools/analyze.py --wav ../deck/public/demos/x.wav --out public/x.json
  python3 tools/analyze.py --bpm-hint 90                     # 템포를 반으로/두 배로 잘못 잡을 때

뽑는 것
  beats      박. 스펙트럼 변화량(onset)에 템포를 맞춘 동적 계획법(Ellis 2007)
  downbeats  마디 첫 박. 네 가지 위상 중 저역 타격이 가장 센 쪽
  sections   구간. 마디 단위 음색·음량 유사도 행렬의 경계(체커보드 커널)를 마디 첫 박에 맞춘다
  frames     영상 프레임(30fps)마다 음량·저역·중역·고역·타격, 스펙트럼 32칸(base64, 0~255)
  peaks      곡 전체 파형 개요

구간 이름(벌스·훅)은 붙이지 않는다. 귀로 확인하기 전에는 에너지 순위만 적는다.
결과: public/hiphop-analysis.json (numpy만 쓴다)
"""
import argparse, base64, json, wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser()
p.add_argument('--wav', default=str(ROOT.parent / 'deck/public/demos/emotional-hiphop-draft.wav'))
p.add_argument('--out', default=str(ROOT / 'public/hiphop-analysis.json'))
p.add_argument('--fps', type=int, default=30)
p.add_argument('--bpm-hint', type=float, default=88, help='템포 사전분포의 중심. 힙합은 대개 70~100')
p.add_argument('--bands', type=int, default=32)
a = p.parse_args()

# ── 읽기 ───────────────────────────────────────────────
with wave.open(a.wav) as w:
    SR, CH, SW, N = w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()
    raw = w.readframes(N)
assert SW == 2, '16bit PCM만 읽는다'
x = np.frombuffer(raw, dtype='<i2').astype(np.float32).reshape(-1, CH).mean(axis=1) / 32768
DUR = len(x) / SR

# ── STFT ───────────────────────────────────────────────
NFFT, HOP = 2048, 512
win = np.hanning(NFFT).astype(np.float32)
pad = np.concatenate([np.zeros(NFFT // 2, np.float32), x, np.zeros(NFFT, np.float32)])
nfr = 1 + (len(pad) - NFFT) // HOP
frames = np.lib.stride_tricks.as_strided(pad, (nfr, NFFT), (pad.strides[0] * HOP, pad.strides[0]))
S = np.abs(np.fft.rfft(frames * win, axis=1)).astype(np.float32) ** 2   # 파워
freqs = np.fft.rfftfreq(NFFT, 1 / SR)
ft = np.arange(nfr) * HOP / SR                                          # STFT 프레임 시각(중심)
FR = SR / HOP

def band(lo, hi):
    m = (freqs >= lo) & (freqs < hi)
    return S[:, m].sum(axis=1)

# 로그 간격 밴드 (화면의 스펙트럼, 구간 특징, onset에 함께 쓴다)
edges = np.geomspace(30, 16000, a.bands + 1)
B = np.stack([band(edges[i], edges[i + 1]) for i in range(a.bands)], axis=1)
logB = np.log1p(B * 1e3)

# ── onset · 템포 · 박 ──────────────────────────────────
def flux(L):
    d = np.diff(L, axis=0, prepend=L[:1])
    return np.maximum(d, 0).sum(axis=1)

def norm_env(e):
    # 국소 평균을 빼고 표준편차로 나눈다(템포 추정은 상대 변화만 본다)
    k = int(FR * .5) | 1
    loc = np.convolve(e, np.ones(k) / k, mode='same')
    e = np.maximum(e - loc, 0)
    return e / (e.std() + 1e-9)

onset = norm_env(flux(logB))
lowOnset = norm_env(flux(logB[:, edges[1:] <= 160]))

def tempo(env):
    ac = np.correlate(env, env, mode='full')[len(env) - 1:]
    lags = np.arange(len(ac))
    bpm = 60 * FR / np.maximum(lags, 1)
    ok = (bpm >= 55) & (bpm <= 200)
    prior = np.exp(-.5 * (np.log2(bpm / a.bpm_hint) / .9) ** 2)
    score = np.where(ok, ac * prior, 0)
    best = int(np.argmax(score))
    # 포물선 보간으로 정수 지연을 다듬는다
    if 1 <= best < len(score) - 1:
        y0, y1, y2 = score[best - 1:best + 2]
        best = best + .5 * (y0 - y2) / (y0 - 2 * y1 + y2 + 1e-12)
    return 60 * FR / best

BPM = tempo(onset)
period = 60 * FR / BPM

def track(env, period, tight=100.):
    # Ellis 2007: 박 간격이 period에서 벗어나면 벌점
    n = len(env)
    score = env.copy()
    back = -np.ones(n, int)
    lo, hi = int(round(period / 2)), int(round(period * 2))
    prev = np.arange(-hi, -lo + 1)
    pen = -tight * np.log(-prev / period) ** 2
    for t in range(hi, n):
        cand = score[t + prev] + pen
        j = int(np.argmax(cand))
        score[t] = env[t] + cand[j]
        back[t] = t + prev[j]
    # 끝에서 마지막 한 주기 안의 최댓값부터 거슬러 올라간다
    t = n - hi + int(np.argmax(score[n - hi:]))
    out = []
    while t >= 0:
        out.append(t)
        t = back[t]
    return np.array(out[::-1])

bi = track(onset, period)
# 곡의 시작 전(무음)에 걸린 박은 버린다
rms = np.sqrt(S.sum(axis=1) / NFFT)
loud = 20 * np.log10(rms + 1e-9)
alive = loud > np.percentile(loud, 95) - 45
first = int(np.argmax(alive))
last = len(alive) - 1 - int(np.argmax(alive[::-1]))
bi = bi[(bi >= first - period * .5) & (bi <= last + period * .5)]
beats = ft[bi]
# 생성된 곡은 템포가 일정하다. 추적한 박에 직선을 맞춰 오차가 작으면 그 격자를 쓴다(화면이 흔들리지 않게)
n_idx = np.arange(len(beats))
slope, icpt = np.polyfit(n_idx, beats, 1)
resid = beats - (slope * n_idx + icpt)
GRID = resid.std() < .05
if GRID:
    beats = slope * n_idx + icpt
    BPM = 60 / slope

# 마디 첫 박: 4가지 위상 중 저역 타격 합이 가장 큰 쪽
phase = int(np.argmax([lowOnset[bi[k::4]].sum() for k in range(4)]))
down_idx = np.arange(phase, len(beats), 4)
downbeats = beats[down_idx]

# ── 구간 ───────────────────────────────────────────────
# 마디마다 밴드 평균(음색) + 음량. 마디가 비슷하면 같은 구간
bar_edges = np.concatenate([downbeats, [ft[min(last, nfr - 1)]]])
if downbeats[0] > ft[first] + .5:
    bar_edges = np.concatenate([[ft[first]], bar_edges])
feat = []
for s, e in zip(bar_edges[:-1], bar_edges[1:]):
    m = (ft >= s) & (ft < e)
    v = logB[m].mean(axis=0) if m.any() else np.zeros(a.bands)
    feat.append(np.concatenate([v, [loud[m].mean() / 10 if m.any() else -10]]))
feat = np.array(feat)
f = feat - feat.mean(axis=0)
f /= np.linalg.norm(f, axis=1, keepdims=True) + 1e-9
SSM = f @ f.T
K = 4                                                     # 반쪽 커널 = 4마디
# 대각 블록(같은 구간끼리)은 +, 엇갈린 블록(앞뒤 구간)은 -
g = np.outer(np.r_[-np.ones(K), np.ones(K)], np.r_[-np.ones(K), np.ones(K)])
g *= np.outer(np.hanning(2 * K + 2)[1:-1], np.hanning(2 * K + 2)[1:-1])
nb = len(feat)
P = np.pad(SSM, K, mode='edge')
nov = np.array([(P[i:i + 2 * K, i:i + 2 * K] * g).sum() for i in range(nb)])
nov = np.maximum(nov, 0)
cuts = [0]
for i in np.argsort(-nov):
    if nov[i] < nov.max() * .25:
        break
    if all(abs(i - c) >= 4 for c in cuts) and nb - i >= 4:
        cuts.append(int(i))
cuts = sorted(cuts)
sec_bounds = [float(bar_edges[c]) for c in cuts] + [float(bar_edges[-1])]
sections = []
for s, e in zip(sec_bounds[:-1], sec_bounds[1:]):
    m = (ft >= s) & (ft < e)
    sections.append({'start': round(s, 3), 'end': round(e, 3), 'loudness': float(loud[m].mean())})
ls = np.array([s['loudness'] for s in sections])
rank = (ls - ls.min()) / (ls.max() - ls.min() + 1e-9)
for s, r in zip(sections, rank):
    s['energy'] = round(float(r), 3)
    del s['loudness']

# ── 영상 프레임 단위 특징 ───────────────────────────────
NV = int(round(DUR * a.fps))
vt = (np.arange(NV) + .5) / a.fps

def at_video(v):
    return np.interp(vt, ft, v)

def unit(v, lo=5, hi=97):
    a0, a1 = np.percentile(v, lo), np.percentile(v, hi)
    return np.clip((v - a0) / (a1 - a0 + 1e-9), 0, 1)

def db(v):
    return 10 * np.log10(v + 1e-10)

def smooth(v, attack, release):
    # 올라갈 때 빠르게, 내려갈 때 천천히(미터처럼). 분석에서 미리 해 두면 화면은 상태가 필요 없다
    out = np.empty_like(v)
    acc = v[0]
    for i, s in enumerate(v):
        acc += (s - acc) * (attack if s > acc else release)
        out[i] = acc
    return out

level = smooth(unit(at_video(loud)), .6, .12)
low = smooth(unit(at_video(db(band(30, 160)))), .7, .18)
mid = smooth(unit(at_video(db(band(160, 2500)))), .5, .12)
high = smooth(unit(at_video(db(band(2500, 12000)))), .6, .2)
# 타격은 짧아서 보간하면 놓친다. 영상 한 프레임에 들어가는 STFT 프레임 중 최댓값
starts = np.minimum((np.arange(NV) / a.fps * FR).astype(int), nfr - 1)
hit = unit(np.maximum.reduceat(onset, starts), 50, 99.5)

spec = unit(np.stack([at_video(logB[:, i]) for i in range(a.bands)], axis=1), 2, 99.5)
spec_b64 = base64.b64encode((spec * 255).round().astype(np.uint8).tobytes()).decode()

NP = 720
seg = np.array_split(np.abs(x), NP)
pk = np.array([s.max() if len(s) else 0 for s in seg])
pk = pk / (pk.max() + 1e-9)

r = lambda v, d=3: [round(float(i), d) for i in v]
out = {
    'source': Path(a.wav).name,
    'duration': round(DUR, 3),
    'fps': a.fps,
    'bpm': round(float(BPM), 2),
    'beatGrid': bool(GRID),
    'beats': r(beats),
    'downbeats': r(downbeats),
    'sections': sections,
    'frames': {
        'count': NV,
        'level': r(level), 'low': r(low), 'mid': r(mid), 'high': r(high), 'hit': r(hit),
        'bands': a.bands, 'spectrum': spec_b64,
    },
    'peaks': r(pk),
}
Path(a.out).parent.mkdir(parents=True, exist_ok=True)
Path(a.out).write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print(f'{Path(a.out).resolve().relative_to(ROOT) if Path(a.out).resolve().is_relative_to(ROOT) else a.out}  {DUR:.1f}s  {BPM:.2f} BPM  박 {len(beats)}  마디 {len(downbeats)}  구간 {len(sections)}'
      f"  {'일정 격자' if GRID else '추적 박'}(잔차 {resid.std() * 1000:.0f}ms)")
for s in sections:
    print(f"  {s['start']:7.2f} ~ {s['end']:7.2f}  energy {s['energy']:.2f}")
