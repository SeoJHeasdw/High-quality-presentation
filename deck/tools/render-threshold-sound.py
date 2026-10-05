"""
37번(abuse-threshold) 두 번째 단계의 소리: 기존 가상 음성(threshold-voices.m4a) 아래에 합성한 사운드 디자인을 깐다.
음성 파일은 바꾸지 않는다. 겹치는 목소리 구간을 잘라 다시 배치하고, 그 사이에 소리를 넣는다.
마지막 말은 같은 "제호" 목소리(threshold-final-line.m4a, Qwen3-TTS + LoRA 0.6)를 낮고 느리고 어둡게 바꿔 쓴다.

  0.0~1.6s  벽 네 개가 가라앉는 낮은 마찰음과 쿵 소리(장면의 벽 타이밍에 맞춤), 군중의 낮은 압력이 시작
  1.7s~     겹치는 목소리. 아래에 단2도·트라이톤의 저음 드론이 반음 올라가며 밝아지고, 심장 박동이 빨라진다
  컷        목소리가 사라지는 지점에서 거꾸로 차오르던 소리째 모두 끊긴다. 귀울림만 남는다
  정적 뒤   "엄마. … 나, 제호 아니야." 같은 목소리가 3반음 낮게, 느리게, 고역을 깎아 가깝게. 마지막 말에만 어두운 잔향
  끝        낮은 울림 하나와 귀울림이 사라진다

  python3 deck/tools/render-threshold-sound.py                 # 기본(strong)
  python3 deck/tools/render-threshold-sound.py --level soft    # 덜 무섭게(soft·mid·strong)
  python3 deck/tools/render-threshold-sound.py --final-pitch -4 --final-tempo .8   # 마지막 말을 더 낮고 느리게
  python3 deck/tools/render-threshold-sound.py --final yuna    # 마지막 말을 예전 합성 여성 목소리로
결과: public/abuse/audio/threshold-scene.m4a (numpy와 ffmpeg만 쓴다)
"""
import argparse, json, subprocess
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'public/abuse/audio'
SR = 48000
p = argparse.ArgumentParser()
p.add_argument('--level', choices=['soft', 'mid', 'strong'], default='strong')
p.add_argument('--final', choices=['jaeho', 'yuna'], default='jaeho')
p.add_argument('--final-pitch', type=float, default=-3, help='마지막 말의 음높이(반음). 재생 속도를 낮춰 목소리 울림도 함께 내린다(그만큼 느려진다)')
p.add_argument('--final-tempo', type=float, default=.85, help='그 위에 음높이는 두고 바꾸는 속도(1보다 작으면 느리게)')
p.add_argument('--out', default=str(AUDIO / 'threshold-scene.m4a'))
a = p.parse_args()
BED = {'soft': .6, 'mid': 1.0, 'strong': 1.45}[a.level]
rng = np.random.default_rng(3709)

# 장면 시간: ThresholdAudio가 단계 진입 50ms 뒤 재생한다. 벽 i는 장면 .15+.2i초에 가라앉기 시작해 .8초 뒤 사라진다.
START_DELAY = .05
WALL_FALL = [.15 + i * .2 - START_DELAY for i in range(4)]
WALL_GONE = [t + .8 for t in WALL_FALL]
CROWD = .4 - START_DELAY
V = 1.7            # 겹치는 목소리가 시작하는 시각
LAYERS_END = 4.42  # 원본에서 겹치는 목소리가 사라지는 시각(4.5~4.6초는 무음)
HUSH = .7          # 컷 뒤 마지막 말까지의 정적
TAIL = 3.2         # 마지막 말 뒤 여운
# 마지막 말(threshold-final-line.m4a, seed 370940)에 넣는 쉼: "엄마," 뒤와 "나" 뒤의 틈(원본 초) → 늘릴 길이
FINAL_PAUSES = [(.44, .32), (.60, .12)]


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def db(x): return 10 ** (x / 20)


def fade(n, kind='in'):
    r = np.linspace(0, 1, n) if kind == 'in' else np.linspace(1, 0, n)
    return np.sin(r * np.pi / 2) ** 2


def band(x, lo, hi):
    """FFT로 자른 대역. 경계는 부드럽게 기울인다."""
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo: m *= 1 / (1 + (lo / np.maximum(f, 1e-3)) ** 4)
    if hi: m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))


def pan(x, p):  # p: -1 왼쪽 ~ 1 오른쪽, 등전력
    th = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(th), x * np.sin(th)], 1)


def dark_line(x):
    """같은 목소리를 낮고 느리고 어둡게: 틈에 쉼 → 음높이·속도 → 고역을 깎고 저중역을 조금 올린다."""
    x = x.mean(1)
    parts, last, k = [], 0, int(.01 * SR)
    for at, extra in FINAL_PAUSES:
        i = int(at * SR); seg = x[last:i].copy(); seg[-k:] *= fade(k, 'out'); parts += [seg, np.zeros(int(extra * SR))]
        last = i; x[last:last + k] = x[last:last + k] * fade(k)
    x = np.concatenate(parts + [x[last:]])
    rate = 2 ** (a.final_pitch / 12)
    x = np.frombuffer(subprocess.run(
        ['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
         '-af', f'asetrate={SR * rate:.0f},aresample={SR},atempo={a.final_tempo}', '-f', 'f32le', '-'],
        input=x.astype(np.float32).tobytes(), capture_output=True, check=True).stdout, dtype=np.float32).astype(np.float64)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    tilt = 1 / np.sqrt(1 + (f / 3200) ** 2) * .55 + .45 * 1 / (1 + (f / 9000) ** 4)   # 3.2kHz 위를 약 -7dB
    body = 1 + .4 * np.exp(-((np.log2(np.maximum(f, 1) / 190)) ** 2) / .5)             # 190Hz 주변 +3dB
    rumble = 1 / (1 + (65 / np.maximum(f, 1e-3)) ** 4)
    x = np.fft.irfft(X * tilt * body * rumble, len(x))
    on = np.nonzero(np.abs(x) > db(-45))[0]
    x = x[max(0, on[0] - int(.012 * SR)):on[-1] + int(.05 * SR)]
    x[:int(.012 * SR)] *= fade(int(.012 * SR)); x[-int(.05 * SR):] *= fade(int(.05 * SR), 'out')
    return np.stack([x, x], 1)


def env_at(t, pts):
    """(시각, dB) 점을 잇는 포락선."""
    ts, vs = zip(*pts)
    return db(np.interp(t, ts, vs))


def conv(x, ir):
    n = len(x) + len(ir) - 1; m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[:n]


def dark_ir(seconds, rt60, lp):
    """지수로 사그라지는 잡음 잔향. 고역이 먼저 죽도록 두 대역을 다른 속도로 줄인다."""
    t = np.arange(int(seconds * SR)) / SR
    lo = band(rng.standard_normal(len(t)), 0, lp) * np.exp(-6.9 * t / rt60)
    hi = band(rng.standard_normal(len(t)), lp, 0) * np.exp(-6.9 * t / (rt60 * .35)) * .25
    ir = np.stack([lo + hi, np.roll(lo, 331) + np.roll(hi, 197)], 1)
    ir[:int(.012 * SR)] *= np.linspace(0, 1, int(.012 * SR))[:, None]
    return ir / np.sqrt((ir ** 2).sum(0)).max()


def thud(dur, f0, f1, decay, drive=2.2):
    """음높이가 내려가는 낮은 쿵. 노트북 스피커에서도 들리도록 포화로 배음을 만든다."""
    t = np.arange(int(dur * SR)) / SR
    f = f1 + (f0 - f1) * np.exp(-t / .06)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay)
    s = np.tanh(s * drive) / np.tanh(drive)
    s[:96] *= np.linspace(0, 1, 96)
    return s


def place(buf, x, at, gain=1.0, p=0.0):
    i = int(at * SR)
    if x.ndim == 1: x = pan(x, p)
    j = min(len(buf), i + len(x))
    buf[i:j] += x[:j - i] * gain


# --- 음성 자르기 ---------------------------------------------------------------
voice = load(AUDIO / 'threshold-voices.m4a')
mono = np.abs(voice).max(1)
search = int(4.5 * SR)
onset = search + int(np.argmax(mono[search:] > db(-40)))      # 마지막 말의 첫 소리
end = onset + int(np.nonzero(mono[onset:] > db(-50))[0][-1])  # 마지막 말의 끝
layers = voice[:int(LAYERS_END * SR)].copy(); layers[-int(.04 * SR):] *= fade(int(.04 * SR), 'out')[:, None]
pre = int(.012 * SR)
final = voice[onset - pre:end + int(.05 * SR)].copy(); final[:pre] *= fade(pre)[:, None]; final[-int(.05 * SR):] *= fade(int(.05 * SR), 'out')[:, None]
if a.final == 'jaeho':  # 예전 마지막 말과 같은 크기(RMS)로 맞춘다
    loud = lambda y: np.sqrt((y[np.abs(y).max(1) > db(-40)] ** 2).mean())
    final = (lambda y: y * loud(final) / loud(y))(dark_line(load(AUDIO / 'threshold-final-line.m4a')))

CUT = V + LAYERS_END
F_AT = CUT + HUSH
F_END = F_AT + len(final) / SR
TOTAL = F_END + TAIL
N = int(TOTAL * SR)
t = np.arange(N) / SR
bed = np.zeros((N, 2))
before_cut = (t < CUT).astype(float)
k = int(.015 * SR); i = int(CUT * SR); before_cut[i - k:i] = fade(k, 'out')

# --- 벽: 가라앉는 마찰음 + 사라질 때의 쿵 ------------------------------------------
for w, (t0, t1) in enumerate(zip(WALL_FALL, WALL_GONE)):
    side = -.45 + w * .3
    n = int((t1 - t0 + .25) * SR); tt = np.arange(n) / SR
    grind = band(rng.standard_normal(n), 60, 520) * np.clip(tt / (t1 - t0), 0, 1) ** 2 * np.exp(-np.maximum(tt - (t1 - t0), 0) / .08)
    place(bed, grind, t0, db(-31) * BED, side)
    place(bed, thud(1.6, 92, 38, .42), t1, db(-17) * BED, side * .6)
    place(bed, band(rng.standard_normal(int(.5 * SR)), 90, 900) * np.exp(-np.arange(int(.5 * SR)) / SR / .09), t1, db(-33) * BED, side)

# --- 군중의 낮은 압력: 다가올수록 커지는 저역 잡음, 걸음 박자(장면 5.5rad/s)로 미세하게 흔들림 -------
crowd = np.stack([band(rng.standard_normal(N), 60, 320), band(rng.standard_normal(N), 60, 320)], 1)
sway = 1 + .35 * np.abs(np.sin(t * 5.5)) * np.clip(t - CROWD, 0, 1)
crowd *= (env_at(t, [(0, -80), (CROWD, -42), (V, -33), (CUT - .4, -27), (CUT, -26)]) * sway * before_cut)[:, None] * BED
bed += crowd

# --- 드론: E1 서브 + E2·F2(단2도)·B♭2(트라이톤), 한 옥타브 위 E3·F3. 목소리 구간 동안 반음 올라가고 밝아진다 ---
def glide(tt):
    return 2 ** (np.clip((tt - V) / (CUT - V), 0, 1) ** 1.6 / 12)


g = glide(t)
bright = np.interp(t, [0, V, CUT], [.25, .4, .7])
drone = np.zeros((N, 2))
for f0, amp, side in [(41.2, .45, 0), (41.86, .35, 0), (82.41, .55, -.5), (87.31, .5, .5), (116.54, .32, -.2), (123.47, .14, .3), (164.81, .2, -.7), (174.61, .18, .7)]:
    for det in (-.0045, 0, .0045):
        ph = 2 * np.pi * np.cumsum(f0 * (1 + det) * g) / SR + rng.uniform(0, 6.28)
        s = np.zeros(N)
        for h in range(1, 14 if f0 > 50 else 4):
            s += np.sin(h * ph) * bright ** (h - 1) / h
        drone += pan(s * amp / 3, side + det * 60)
drone *= (env_at(t, [(0, -90), (WALL_GONE[0], -38), (V, -27), (CUT - 1.2, -23), (CUT, -18)]) * before_cut)[:, None] * BED
bed += drone

# --- 심장 박동: 목소리와 함께 시작, 66→92bpm으로 빨라지다 컷에서 멈춘다 ----------------------------------
bt = V - .25
while bt < CUT - .1:
    x = (bt - V) / (CUT - V)
    lvl = db(-24 + 6 * max(0, x)) * BED
    place(bed, thud(.5, 70, 46, .09, 3), bt, lvl)
    place(bed, thud(.4, 64, 44, .07, 3), bt + .29, lvl * .55)
    bt += 60 / (66 + 26 * max(0, x) ** 1.3)

# --- 거꾸로 차오르는 소리: 컷 직전 1초 동안 숨을 들이켜듯 커지다 끊긴다 -----------------------------------
n = int(1.15 * SR); tt = np.arange(n) / SR
swell = np.stack([band(rng.standard_normal(n), 700, 7000), band(rng.standard_normal(n), 700, 7000)], 1)
swell *= (np.exp((tt - tt[-1]) / .32) ** 1.4)[:, None]
bed[int(CUT * SR) - n:int(CUT * SR)] += swell * db(-27) * BED * before_cut[int(CUT * SR) - n:int(CUT * SR), None]

# --- 귀울림: 컷 뒤 정적과 마지막 말 동안 홀로 남는다 ----------------------------------------------------
ring = np.sin(2 * np.pi * 6150 * t) * (1 + .15 * np.sin(2 * np.pi * .7 * t))
ring_env = env_at(t, [(0, -120), (V + 2.0, -70), (CUT, -49), (F_END, -51), (TOTAL - .4, -66), (TOTAL, -120)])
bed += pan(ring * ring_env * min(BED, 1.0), .15)

# --- 마지막 말 뒤: 낮은 울림 하나 -----------------------------------------------------------------------
place(bed, thud(TAIL, 58, 31, .6, 1.6), F_END - .02, db(-24) * BED)
low = np.stack([band(rng.standard_normal(N), 30, 140)] * 2, 1)
bed += low * env_at(t, [(0, -120), (F_END, -120), (F_END + .2, -43), (TOTAL, -75)])[:, None] * BED

# --- 음성 배치 ------------------------------------------------------------------------------------
mix = bed.copy()
place(mix, layers, V)
final_l = np.zeros((len(final) + int(TAIL * SR), 2)); final_l[:len(final)] = final
wet = np.stack([conv(final_l[:, c], dark_ir(2.4, 1.9, 1400)[:, c])[:len(final_l)] for c in range(2)], 1)
lastword = np.interp(np.arange(len(final_l)) / SR, [0, len(final) / SR * .6, len(final) / SR], [0, .25, 1])  # 마지막 말에만 잔향
place(mix, final_l + wet * db(-14) * lastword[:, None], F_AT)

peak = np.abs(mix).max()
if peak > db(-1): mix *= db(-1) / peak
mix[-int(.3 * SR):] *= fade(int(.3 * SR), 'out')[:, None]

out = Path(a.out)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(out)],
               input=mix.astype(np.float32).tobytes(), check=True)
info = {'level': a.level, 'final': a.final, 'durationSeconds': round(TOTAL, 2), 'layersAt': V, 'cutAt': round(CUT, 2), 'finalLineAt': round(F_AT, 2),
        'finalLineEnds': round(F_END, 2), 'sourceFinalOnset': round(onset / SR, 3), 'peakDb': round(20 * np.log10(np.abs(mix).max()), 1)}
print(json.dumps(info, ensure_ascii=False))
