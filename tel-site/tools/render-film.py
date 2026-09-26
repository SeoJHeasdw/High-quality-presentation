#!/usr/bin/env python3
"""TEL 홈페이지 · 선에서 빛까지.

해 질 녘 강변의 빈 대지에 측량선 한 줄이 그어지고, 선이 평면이 되고, 기초가 부어지고,
48층 비틀린 타워가 크레인과 함께 층층이 올라가 커튼월을 입는다. 해가 지면 층마다 불이 켜지고
카메라가 물러나며 강 건너 도시와 TEL이 지은 다른 현장들이 빛으로 이어진다.
홈페이지는 이 영상의 프레임을 스크롤 위치로 고른다(13번 장표와 같은 방식).
정지 지점(ANCHORS)에서는 카메라·크레인·공정이 모두 멈춰 있어 프레임이 선명하다.

  blender -b --python tel-site/tools/render-film.py -- --mode layout
  blender -b --python tel-site/tools/render-film.py -- --mode still --scale 40 --samples 24
  blender -b --python tel-site/tools/render-film.py -- --mode still --frames 300,500 --scale 100
  blender -b --python tel-site/tools/render-film.py -- --mode final [--frames 0-340]
  blender -b --python tel-site/tools/render-film.py -- --mode track     # 라벨 좌표만
  blender -b --python tel-site/tools/render-film.py -- --mode shot --shot bridge   # 프로젝트 사진

결과 프레임은 render/film/frames/, 라벨 좌표는 src/film/track.json.
인코딩은 tools/encode-film.sh.
"""
import bpy, math, json, sys, argparse, random, time, zlib
from pathlib import Path
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "render/film"
TRACK = ROOT / "src/film/track.json"
TWIN = ROOT / "src/twin/tower.json"
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mode", choices=["still", "final", "track", "layout", "shot", "verify"], default="still")
ap.add_argument("--frames", default="")
ap.add_argument("--samples", type=int, default=0)
ap.add_argument("--scale", type=int, default=0, help="resolution percentage")
ap.add_argument("--out", default="")
ap.add_argument("--save", action="store_true")
ap.add_argument("--shots", default="", help='구도 실험: {"5": {"eye": [x, y, z]}}')
ap.add_argument("--shot", default="", help="프로젝트 사진 이름(SHOTS_STILL)")
ap.add_argument("--noblur", action="store_true")
ap.add_argument("--hd", action="store_true", help="2560×1440 마스터")
A = ap.parse_args(ARGS)

FPS = 30
# 페이지의 장(章)과 1:1로 대응하는 정지 지점.
# 0 첫 선 · 1 측량 · 2 기초 · 3 골조 · 4 상량 · 5 준공 · 6 점등 · 7 도시
ANCHORS = [0, 96, 192, 300, 408, 500, 590, 680]
LAST = ANCHORS[-1]
W, H = 1920, 1080

# 타워 제원(가상의 프로젝트). 웹의 디지털 트윈도 같은 값을 쓴다.
PL = 0.3          # 광장 바닥 높이
FH = 4.2          # 층고
NF = 48           # 층수
HALF = 19.0       # 기준층 반폭(38 m)
SQN = 5.2         # 초타원 지수: 모서리가 둥근 정사각형
TWIST = 1.2       # 층당 회전(도)
TAPER = .14       # 최상층 축소 비율
M = 96            # 둘레 분할
CORE = 8.0        # 코어 반폭(16 m)
COLR = 12.2       # 기둥 반지름
NCOL = 12
CROWN = 5         # 왕관 층수(핀만)
INSTR = Vector((22.0, -31.0, 0.0))   # 토탈스테이션 자리


# ── 수학 ─────────────────────────────────────────────────────────────
def clamp01(x): return max(0.0, min(1.0, x))
def lerp(a, b, t): return a + (b - a) * t
def ease_io(t):
    t = clamp01(t)
    return 4 * t * t * t if t < .5 else 1 - (-2 * t + 2) ** 3 / 2
def ease_out(t, p=3.0): return 1 - (1 - clamp01(t)) ** p
def ease_in(t, p=2.0): return clamp01(t) ** p
def smooth(t): t = clamp01(t); return t * t * (3 - 2 * t)
def ramp(f, f0, f1, fn=ease_io): return fn((f - f0) / (f1 - f0)) if f1 > f0 else float(f >= f1)
def catmull(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)


def piece(tbl, f, fn=None):
    """(프레임, 값) 표를 단조 3차 곡선(Fritsch–Carlson)으로 잇는다.
    중간 지점에서는 멈추지 않고 지나가고(스크롤을 멈춘 장면도 계속 살아 있게), 값이 되돌아가지 않는다.
    처음과 끝 지점에서만 속도가 0이다."""
    xs = [a for a, _ in tbl]; ys = [b for _, b in tbl]
    if f <= xs[0]: return ys[0]
    if f >= xs[-1]: return ys[-1]
    n = len(xs)
    d = [(ys[i + 1] - ys[i]) / max(1e-9, xs[i + 1] - xs[i]) for i in range(n - 1)]
    m = [0.0] * n
    for i in range(1, n - 1):
        m[i] = 0.0 if d[i - 1] * d[i] <= 0 else (d[i - 1] + d[i]) / 2
    for i in range(n - 1):
        if d[i] == 0: m[i] = m[i + 1] = 0.0; continue
        a, b = m[i] / d[i], m[i + 1] / d[i]
        if a * a + b * b > 9:
            t = 3 / math.sqrt(a * a + b * b); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]
    i = max(k for k in range(n - 1) if xs[k] <= f)
    h = xs[i + 1] - xs[i]; s_ = (f - xs[i]) / h
    return hermite(ys[i], ys[i + 1], m[i] * h, m[i + 1] * h, s_)


def hermite(p0, p1, m0, m1, s):
    s2, s3 = s * s, s * s * s
    return p0 * (2 * s3 - 3 * s2 + 1) + m0 * (s3 - 2 * s2 + s) + p1 * (-2 * s3 + 3 * s2) + m1 * (s3 - s2)


def spline(keys, f):
    """(프레임, 값) 열쇠를 캣멀–롬 접선의 3차 곡선으로 잇는다(값은 수 또는 Vector). 처음과 끝에서만 멈춘다."""
    ts = [k for k, _ in keys]; ps = [v for _, v in keys]
    if f <= ts[0]: return ps[0]
    if f >= ts[-1]: return ps[-1]
    n = len(ts)
    zero = ps[0] * 0
    m = [zero] + [(ps[i + 1] - ps[i - 1]) / (ts[i + 1] - ts[i - 1]) for i in range(1, n - 1)] + [zero]
    i = max(k for k in range(n - 1) if ts[k] <= f)
    h = ts[i + 1] - ts[i]
    return hermite(ps[i], ps[i + 1], m[i] * h, m[i + 1] * h, (f - ts[i]) / h)


# ── 공정표 ───────────────────────────────────────────────────────────
# 단위는 층. 정지 지점(192, 300, 408)에서 모든 공정이 멈춘다.
def slabs(f): return piece([(0, 0), (148, 0), (192, 3), (300, 22), (408, 48)], f)
def core_floors(f): return piece([(0, 0), (140, 0), (192, 6), (300, 25.5), (408, 50)], f)
def facade(f): return piece([(0, 0), (196, 0), (300, 13), (408, 40), (472, 48)], f)
def crown(f): return piece([(0, 0), (436, 0), (488, CROWN)], f)
def paving(f): return piece([(0, 0), (446, 0), (494, 1.0)], f)       # 0~1: 광장 포장이 퍼진 비율
def wave(f): return piece([(0, -2), (502, -2), (568, NF + 3)], f)     # 실내등이 켜진 층
def core_top(f): return PL + core_floors(f) * FH
def slab_top(f): return PL + slabs(f) * FH


def floor_scale(k): return 1 - TAPER * (clamp01(k / (NF - 1)) ** 1.25)
def floor_rot(k): return math.radians(TWIST * k)


# ── 장면 기본 ─────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene
S.frame_start, S.frame_end = 0, LAST
S.render.fps = FPS
S.render.resolution_x, S.render.resolution_y = W, H
S.render.resolution_percentage = A.scale or (100 if A.mode in ("final", "shot") else 40)
if A.hd:
    S.render.resolution_x, S.render.resolution_y = 2560, 1440
S.render.engine = "CYCLES"
S.cycles.device = "GPU"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "METAL"
prefs.get_devices()
for d in prefs.devices: d.use = d.type == "METAL"
S.cycles.samples = A.samples or (128 if A.mode in ("final", "shot") else 32)
S.cycles.use_adaptive_sampling = True
S.cycles.adaptive_threshold = 0.02
S.cycles.use_denoising = True
S.cycles.denoiser = "OPENIMAGEDENOISE"
S.cycles.denoising_use_gpu = True
S.cycles.max_bounces, S.cycles.diffuse_bounces, S.cycles.glossy_bounces = 8, 2, 4
S.cycles.transmission_bounces, S.cycles.transparent_max_bounces = 8, 16
S.cycles.sample_clamp_indirect = 6.0
S.cycles.caustics_reflective = S.cycles.caustics_refractive = False
S.cycles.use_light_tree = True
S.render.use_persistent_data = True
S.render.use_motion_blur = A.mode == "final" and not A.noblur
S.render.motion_blur_shutter = 0.3
S.render.image_settings.file_format = "PNG"
S.render.image_settings.color_mode = "RGB"
S.render.image_settings.color_depth = "8"
S.view_settings.view_transform = "AgX"
for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
    try: S.view_settings.look = look; break
    except Exception: pass

COLL = S.collection


def put(ob, coll=None):
    (coll or COLL).objects.link(ob)
    return ob


# ── 애니메이션: 프레임마다 값을 직접 굽는다 ───────────────────────────
def bake(idb, path, samples, index=0, interp="LINEAR"):
    ad = idb.animation_data or idb.animation_data_create()
    if ad.action is None:
        ad.action = bpy.data.actions.new(f"{idb.name}·anim")
    fc = ad.action.fcurve_ensure_for_datablock(idb, path, index=index)
    kp = fc.keyframe_points
    start = len(kp)
    kp.add(len(samples))
    for k, (f, v) in zip(list(kp)[start:], samples):
        k.co = (f, v)
        k.interpolation = interp
    fc.update()
    return fc


def span(f0, f1): return list(range(int(f0), int(f1) + 1))
ALL = list(range(0, LAST + 1))


def fn_samples(fn, f0=0, f1=LAST, step=1):
    fr = sorted({0, *range(int(f0), int(f1) + 1, step), int(f1), LAST})
    return [(f, fn(f)) for f in fr]


def prop(ob, name, samples, default=0.0):
    ob[name] = float(default)
    bake(ob, f'["{name}"]', samples)


def hide_until(ob, f):
    ob.hide_render = True
    bake(ob, "hide_render", [(0, 1), (max(0, f - 1), 1), (f, 0), (LAST, 0)], interp="CONSTANT")


def visible_between(ob, f0, f1):
    """f0부터 f1까지만 렌더된다."""
    ob.hide_render = True
    bake(ob, "hide_render", [(0, 1), (max(0, f0 - 1), 1), (f0, 0), (f1, 0), (f1 + 1, 1), (LAST, 1)], interp="CONSTANT")


# ── 재질 ─────────────────────────────────────────────────────────────
def no_emission_sampling(m):
    for owner in (m, getattr(m, "cycles", None)):
        if owner is not None and hasattr(owner, "emission_sampling"):
            try: owner.emission_sampling = "NONE"
            except Exception: pass


def tree_of(m):
    m.use_nodes = True
    return m.node_tree.nodes, m.node_tree.links


def sock(sockets, ident):
    for s in sockets:
        if s.identifier == ident: return s
    raise KeyError(ident)


def mix_rgb(N, blend="MIX"):
    n = N.new("ShaderNodeMix"); n.data_type = "RGBA"; n.blend_type = blend
    return sock(n.inputs, "Factor_Float"), sock(n.inputs, "A_Color"), sock(n.inputs, "B_Color"), sock(n.outputs, "Result_Color")


class Graph:
    """셰이더 수식을 짧게 쓰기 위한 도우미."""
    def __init__(self, m):
        self.N, self.L = tree_of(m)

    def attr(self, name, kind="GEOMETRY"):
        a = self.N.new("ShaderNodeAttribute"); a.attribute_type = kind; a.attribute_name = name
        return a.outputs["Fac"]

    def M(self, op, a=None, c=None, clamp=False):
        n = self.N.new("ShaderNodeMath"); n.operation = op; n.use_clamp = clamp
        for k, v in enumerate((a, c)):
            if isinstance(v, (int, float)): n.inputs[k].default_value = v
            elif v is not None: self.L.new(v, n.inputs[k])
        return n.outputs[0]

    def noise(self, a, c, w):
        wn = self.N.new("ShaderNodeTexWhiteNoise"); wn.noise_dimensions = "4D"
        v = self.N.new("ShaderNodeCombineXYZ")
        for k, x in enumerate((a, c)):
            if isinstance(x, (int, float)): v.inputs[k].default_value = x
            else: self.L.new(x, v.inputs[k])
        self.L.new(v.outputs[0], wn.inputs["Vector"]); wn.inputs["W"].default_value = w
        return wn.outputs["Value"]


def principled(name, color, rough=.5, metal=0.0, spec=.5):
    m = bpy.data.materials.new(name)
    N, _ = tree_of(m)
    b = N["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Specular IOR Level"].default_value = spec
    m.diffuse_color = (*color, 1)
    return m


def textured(name, lo, hi, rough=.8, scale=1.4, bump=.12, stretch=(1, 1, 1), variation=True, rough_var=.1, coords="Object"):
    m = bpy.data.materials.new(name)
    N, L = tree_of(m)
    b = N["Principled BSDF"]
    tc = N.new("ShaderNodeTexCoord")
    mp = N.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = stretch
    if coords == "World":
        geo = N.new("ShaderNodeNewGeometry"); L.new(geo.outputs["Position"], mp.inputs["Vector"])
    else:
        L.new(tc.outputs[coords], mp.inputs["Vector"])
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = 9; nz.inputs["Roughness"].default_value = .6
    L.new(mp.outputs["Vector"], nz.inputs["Vector"])
    cr = N.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].position, cr.color_ramp.elements[0].color = .32, (*lo, 1)
    cr.color_ramp.elements[1].position, cr.color_ramp.elements[1].color = .72, (*hi, 1)
    L.new(nz.outputs["Fac"], cr.inputs["Fac"])
    col = cr.outputs["Color"]
    if variation:
        gi = N.new("ShaderNodeNewGeometry")
        fac, ma, mb, mo = mix_rgb(N, "MULTIPLY")
        v = N.new("ShaderNodeMapRange"); v.inputs["To Min"].default_value = .88; v.inputs["To Max"].default_value = 1.08
        L.new(gi.outputs["Random Per Island"], v.inputs["Value"])
        cmb = N.new("ShaderNodeCombineXYZ")
        for k in range(3): L.new(v.outputs["Result"], cmb.inputs[k])
        fac.default_value = 1.0
        L.new(col, ma); L.new(cmb.outputs["Vector"], mb)
        col = mo
    L.new(col, b.inputs["Base Color"])
    rr = N.new("ShaderNodeMapRange"); rr.inputs["To Min"].default_value = rough - rough_var; rr.inputs["To Max"].default_value = rough + rough_var
    L.new(nz.outputs["Fac"], rr.inputs["Value"]); L.new(rr.outputs["Result"], b.inputs["Roughness"])
    if bump:
        bp = N.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump; bp.inputs["Distance"].default_value = .02
        L.new(nz.outputs["Fac"], bp.inputs["Height"]); L.new(bp.outputs["Normal"], b.inputs["Normal"])
    m.diffuse_color = (*hi, 1)
    return m


def glass(name, tint=(.8, .87, .9), rough=.015, reflect_boost=0.0):
    """얇은 판유리: 반사는 Fresnel, 그림자 광선은 통과시켜 실내 빛이 밖으로 새어 나온다."""
    m = bpy.data.materials.new(name)
    N, L = tree_of(m)
    b = N["Principled BSDF"]; out = N["Material Output"]
    b.inputs["Base Color"].default_value = (*tint, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Transmission Weight"].default_value = 1.0
    b.inputs["IOR"].default_value = 1.52 + reflect_boost
    try: b.inputs["Thin Wall"].default_value = True
    except Exception: pass
    tr = N.new("ShaderNodeBsdfTransparent")
    lp = N.new("ShaderNodeLightPath")
    mx = N.new("ShaderNodeMixShader")
    L.new(lp.outputs["Is Shadow Ray"], mx.inputs["Fac"])
    L.new(b.outputs["BSDF"], mx.inputs[1]); L.new(tr.outputs["BSDF"], mx.inputs[2])
    L.new(mx.outputs[0], out.inputs["Surface"])
    m.diffuse_color = (.1, .14, .16, 1)
    return m


def coated_glass(name):
    """커튼월: 얇은 판유리 투과(실내가 비친다)에 저반사 코팅의 금속성 반사를 섞는다."""
    m = glass(name, tint=(.6, .72, .76), rough=.01)
    N, L = tree_of(m)
    out = N["Material Output"]
    mix = out.inputs["Surface"].links[0].from_node
    gl = N.new("ShaderNodeBsdfGlossy"); gl.inputs["Color"].default_value = (.46, .56, .62, 1); gl.inputs["Roughness"].default_value = .02
    lw = N.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = .35
    mm = N.new("ShaderNodeMath"); mm.operation = "MULTIPLY_ADD"
    L.new(lw.outputs["Fresnel"], mm.inputs[0]); mm.inputs[1].default_value = .55; mm.inputs[2].default_value = .22
    mx2 = N.new("ShaderNodeMixShader")
    L.new(mm.outputs[0], mx2.inputs[0]); L.new(mix.outputs[0], mx2.inputs[1]); L.new(gl.outputs[0], mx2.inputs[2])
    L.new(mx2.outputs[0], out.inputs["Surface"])
    return m


def emissive(name, color, strength, attr="lit", sample=False):
    m = bpy.data.materials.new(name)
    N, L = tree_of(m); N.clear()
    out = N.new("ShaderNodeOutputMaterial"); em = N.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    at = N.new("ShaderNodeAttribute"); at.attribute_type = "OBJECT"; at.attribute_name = attr
    mul = N.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = strength
    L.new(at.outputs["Fac"], mul.inputs[0]); L.new(mul.outputs[0], em.inputs["Strength"])
    L.new(em.outputs[0], out.inputs["Surface"])
    if not sample: no_emission_sampling(m)
    m.diffuse_color = (*color, 1)
    return m


def lit_emission(m, color, strength, attr="lit"):
    N, L = tree_of(m)
    b = N["Principled BSDF"]
    at = N.new("ShaderNodeAttribute"); at.attribute_type = "OBJECT"; at.attribute_name = attr
    mul = N.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = strength
    L.new(at.outputs["Fac"], mul.inputs[0])
    b.inputs["Emission Color"].default_value = (*color, 1)
    L.new(mul.outputs[0], b.inputs["Emission Strength"])
    return m


CYAN = (.26, .72, 1.0)
WARM = (1.0, .68, .4)


def line_mat(name, color=CYAN, strength=9.0):
    """측량선. 선마다(면 속성 t0·t1) 정해진 프레임 동안 한쪽 끝(점 속성 u)부터 그려진다.
    오브젝트 속성 clock은 현재 프레임, fade는 전체 밝기. 그려지는 끝은 잠깐 더 밝다."""
    m = bpy.data.materials.new(name)
    N, L = tree_of(m); N.clear()
    g = Graph(m)
    out = N.new("ShaderNodeOutputMaterial"); em = N.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (*color, 1)
    tr = N.new("ShaderNodeBsdfTransparent"); mx = N.new("ShaderNodeMixShader")
    u, t0, t1 = g.attr("u"), g.attr("t0"), g.attr("t1")
    clock, fade = g.attr("clock", "OBJECT"), g.attr("fade", "OBJECT")
    prog = g.M("DIVIDE", g.M("SUBTRACT", clock, t0), g.M("MAXIMUM", g.M("SUBTRACT", t1, t0), .001), clamp=True)
    vis = g.M("MULTIPLY", g.M("LESS_THAN", u, prog), g.M("GREATER_THAN", prog, .001))
    head = g.M("MULTIPLY", g.M("SUBTRACT", 1.0, g.M("DIVIDE", g.M("SUBTRACT", prog, u), .05), clamp=True), g.M("LESS_THAN", prog, .999))
    alpha = g.M("MULTIPLY", vis, fade)
    L.new(g.M("MULTIPLY", g.M("ADD", 1.0, g.M("MULTIPLY", head, 5.0)), strength), em.inputs["Strength"])
    L.new(alpha, mx.inputs[0]); L.new(tr.outputs[0], mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], out.inputs["Surface"])
    no_emission_sampling(m)
    m.diffuse_color = (*color, 1)
    return m


def fade_mat(name, color=CYAN, strength=3.4, attr="fade"):
    """오브젝트 속성 하나로 투명해지는 발광(발광만 0이 되면 검은 선이 남는다)."""
    m = emissive(name, color, strength, attr=attr)
    N, L = tree_of(m)
    out = next(n for n in N if n.type == "OUTPUT_MATERIAL")
    em = next(n for n in N if n.type == "EMISSION")
    at = next(n for n in N if n.type == "ATTRIBUTE")
    tr = N.new("ShaderNodeBsdfTransparent"); mx = N.new("ShaderNodeMixShader")
    cl = N.new("ShaderNodeMath"); cl.operation = "MINIMUM"; cl.inputs[1].default_value = 1.0
    L.new(at.outputs["Fac"], cl.inputs[0])
    L.new(cl.outputs[0], mx.inputs[0]); L.new(tr.outputs[0], mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], out.inputs["Surface"])
    return m


def scan_glow(m, color=CYAN, strength=2.2, width=1.2):
    """GN이 기록한 age(방금 놓인 층일수록 0에 가깝다)로 새 부재의 모서리를 잠깐 밝힌다."""
    N, L = tree_of(m)
    g = Graph(m)
    b = N["Principled BSDF"]
    age = g.attr("age")
    fresh = g.M("MULTIPLY", g.M("SUBTRACT", 1.0, g.M("DIVIDE", age, width), clamp=True), g.M("GREATER_THAN", age, .0001))
    b.inputs["Emission Color"].default_value = (*color, 1)
    L.new(g.M("MULTIPLY", g.M("POWER", fresh, 2.0), strength), b.inputs["Emission Strength"])
    return m


def water(name, dark=(.006, .012, .016), rough=.035, scale=(.03, .6, 1), bump=.18):
    m = bpy.data.materials.new(name)
    N, L = tree_of(m)
    b = N["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*dark, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Specular IOR Level"].default_value = .7
    b.inputs["IOR"].default_value = 1.333
    geo = N.new("ShaderNodeNewGeometry")
    mp = N.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = scale
    L.new(geo.outputs["Position"], mp.inputs["Vector"])
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 1.0; nz.inputs["Detail"].default_value = 6
    L.new(mp.outputs["Vector"], nz.inputs["Vector"])
    bp = N.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump; bp.inputs["Distance"].default_value = .12
    L.new(nz.outputs["Fac"], bp.inputs["Height"]); L.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def interior_mat():
    """층마다 켜지는 천장. 오브젝트 속성 wave(층)보다 낮은 층부터, 칸(베이)마다 조금씩 늦게.
    사무층은 흰빛, 위쪽 호텔·레지던스 층은 따뜻한 빛. 꺼진 곳은 어두운 천장."""
    m = bpy.data.materials.new("tower ceiling")
    N, L = tree_of(m); N.clear()
    g = Graph(m)
    out = N.new("ShaderNodeOutputMaterial")
    df = N.new("ShaderNodeBsdfDiffuse"); df.inputs["Color"].default_value = (.05, .05, .05, 1)
    em = N.new("ShaderNodeEmission"); ad = N.new("ShaderNodeAddShader")
    fl, an = g.attr("fl"), g.attr("an")
    wv = g.attr("wave", "OBJECT")
    bay = g.M("FLOOR", g.M("MULTIPLY", an, 48.0))
    jitter = g.noise(fl, 0.0, 1.0)
    on_time = g.M("GREATER_THAN", g.M("SUBTRACT", wv, g.M("MULTIPLY", g.noise(fl, bay, 1.5), 1.6)), fl)
    floor_on = g.M("GREATER_THAN", jitter, .1)
    bay_on = g.M("GREATER_THAN", g.noise(fl, bay, 2.0), .06)
    lobby = g.M("LESS_THAN", fl, 2.5)
    on = g.M("MULTIPLY", on_time, g.M("MAXIMUM", g.M("MULTIPLY", floor_on, bay_on), lobby))
    bright = g.M("ADD", .55, g.M("MULTIPLY", g.noise(fl, 0.0, 3.0), .7))
    L.new(g.M("MULTIPLY", g.M("MULTIPLY", on, bright), 2.4), em.inputs["Strength"])
    cf, ca, cb, co = mix_rgb(N)
    ca.default_value = (1.0, .82, .62, 1); cb.default_value = (1.0, .6, .32, 1)
    L.new(g.M("GREATER_THAN", fl, 37.5), cf)
    L.new(co, em.inputs["Color"])
    L.new(df.outputs[0], ad.inputs[0]); L.new(em.outputs[0], ad.inputs[1])
    L.new(ad.outputs[0], out.inputs["Surface"])
    return m


def interior_floor_mat():
    """바닥은 켜진 천장을 받아 조금 밝아진다(층마다 면광원을 두지 않고 흉내만)."""
    m = bpy.data.materials.new("tower floor")
    N, L = tree_of(m)
    g = Graph(m)
    b = N["Principled BSDF"]
    b.inputs["Base Color"].default_value = (.32, .3, .28, 1); b.inputs["Roughness"].default_value = .35
    fl = g.attr("fl"); wv = g.attr("wave", "OBJECT")
    on = g.M("GREATER_THAN", g.M("SUBTRACT", wv, .8), fl)
    b.inputs["Emission Color"].default_value = (1.0, .78, .56, 1)
    L.new(g.M("MULTIPLY", on, .55), b.inputs["Emission Strength"])
    return m


CONCRETE = textured("core concrete", (.24, .236, .228), (.36, .352, .34), rough=.86, scale=.35, bump=.14, coords="World")
SLABCON = scan_glow(textured("slab concrete", (.2, .196, .19), (.3, .294, .284), rough=.78, scale=.5, bump=.05, coords="World"))
RAFT = textured("raft concrete", (.26, .255, .245), (.4, .39, .37), rough=.8, scale=.3, bump=.12, coords="World")
STEEL = scan_glow(principled("steel column", (.06, .062, .066), rough=.42, metal=1.0), strength=2.0)
FIN = principled("champagne fin", (.74, .66, .52), rough=.22, metal=1.0)
SPANDREL = principled("dark bronze spandrel", (.05, .045, .04), rough=.32, metal=1.0)
CURTAIN = coated_glass("curtain glass")
CEILING = interior_mat()
SCREEN = principled("screen mesh", (.03, .032, .036), rough=.55, metal=.5)
SCREEN_BAND = emissive("screen line", CYAN, 9.0, attr="on")
IFLOOR = interior_floor_mat()
CRANE = principled("crane paint", (.78, .77, .72), rough=.45, spec=.4)
CRANE_DARK = principled("crane machinery", (.05, .05, .055), rough=.5, metal=.6)
COUNTERWT = textured("counterweight", (.3, .3, .29), (.45, .44, .42), rough=.85, scale=2, bump=.1)
AVIATION = emissive("aviation light", (1.0, .08, .04), 70.0, attr="on")
WORKLIGHT = emissive("work light", (1.0, .86, .7), 26.0, attr="on")
FORMWORK = principled("jump form", (.07, .075, .08), rough=.6, metal=.3)
PAVING = textured("plaza granite", (.13, .127, .122), (.21, .205, .195), rough=.5, scale=.9, bump=.05, coords="World")
COPING = textured("coping stone", (.12, .118, .115), (.2, .195, .19), rough=.5, scale=2.0, bump=.05, coords="World")
POOLWATER = water("reflecting pool", dark=(.004, .006, .008), rough=.008, scale=(.4, .4, 1), bump=.03)
RIVER = water("river", dark=(.008, .014, .018), rough=.04, scale=(.012, .09, 1), bump=.22)
GRAVEL = textured("site gravel", (.038, .035, .031), (.075, .069, .06), rough=.95, scale=3.5, bump=.3, variation=False, coords="World")
ASPHALT = textured("asphalt", (.03, .03, .032), (.055, .055, .058), rough=.8, scale=4, bump=.1, variation=False, coords="World")
EMBANK = textured("embankment", (.1, .1, .1), (.18, .175, .17), rough=.85, scale=.6, bump=.15, coords="World")
LEAF = textured("leaves", (.012, .03, .014), (.04, .07, .03), rough=.8, scale=14, bump=.7, variation=True)
BARK = principled("bark", (.05, .04, .032), rough=.9)
BRIDGE_CON = textured("bridge concrete", (.4, .395, .38), (.56, .55, .53), rough=.8, scale=.2, bump=.1, coords="World")
CABLE = principled("stay cable", (.8, .8, .78), rough=.3, metal=.5)
LINE = line_mat("survey line")
LINE_DIM = fade_mat("survey dots", CYAN, 8.0)
LED = emissive("plaza led", (1.0, .74, .48), 14.0)
STREET = emissive("street lamp", (1.0, .72, .42), 40.0)
BRIDGE_LED = emissive("bridge led", (1.0, .9, .78), 12.0)
PYLON_WASH = emissive("pylon wash", (1.0, .86, .7), 1.6)
CROWN_GLOW = emissive("crown glow", (1.0, .8, .56), 16.0)
BEAM = fade_mat("laser", (.5, .9, 1.0), 40.0, attr="on")
ARC = fade_mat("site arc", CYAN, 7.0)
RING = fade_mat("site ring", CYAN, 6.0)


# ── 형상 ─────────────────────────────────────────────────────────────
class Builder:
    """면을 한 메시에 모은다. 면마다 재질 번호와 float 속성(fl, an …)을 가질 수 있다."""
    def __init__(self, *mats):
        self.v, self.f, self.mi, self.fa, self.pa, self.mats = [], [], [], [], [], list(mats)

    def _face(self, idx, mi, fa):
        self.f.append(tuple(idx)); self.mi.append(mi); self.fa.append(fa)

    def box(self, x0, x1, y0, y1, z0, z1, mi=0, **fa):
        return self.hexa([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], mi, **fa)

    def hexa(self, c, mi=0, **fa):
        """여덟 꼭짓점(아래 넷, 위 넷, 반시계)."""
        o = len(self.v)
        self.v += [tuple(p) for p in c]; self.pa += [{}] * 8
        for q in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
            self._face([o + i for i in q], mi, fa)
        return self

    def obox(self, center, ux, uy, uz, hx, hy, hz, mi=0, **fa):
        c, ux, uy, uz = Vector(center), Vector(ux).normalized(), Vector(uy).normalized(), Vector(uz).normalized()
        pts = []
        for sz in (-1, 1):
            for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                pts.append(c + ux * hx * sx + uy * hy * sy + uz * hz * sz)
        return self.hexa(pts, mi, **fa)

    def strut(self, a, b, t, mi=0, **fa):
        a, b = Vector(a), Vector(b)
        d = (b - a); ln = d.length
        if ln < 1e-6: return self
        d.normalize()
        up = Vector((0, 0, 1)) if abs(d.z) < .9 else Vector((1, 0, 0))
        u = d.cross(up).normalized(); v = d.cross(u).normalized()
        return self.obox((a + b) / 2, u, v, d, t / 2, t / 2, ln / 2, mi, **fa)

    def quad(self, pts, mi=0, pa=None, **fa):
        o = len(self.v); self.v += [tuple(p) for p in pts]
        self.pa += pa if pa else [{}] * len(pts)
        self._face(list(range(o, o + len(pts))), mi, fa)
        return self

    def build(self, name, bevel=0.0, coll=None, smooth=False):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f); me.update()
        for m in self.mats: me.materials.append(m)
        me.polygons.foreach_set("material_index", self.mi)
        for key in sorted({k for d in self.fa for k in d}):
            at = me.attributes.new(key, "FLOAT", "FACE")
            at.data.foreach_set("value", [float(d.get(key, 0.0)) for d in self.fa])
        for key in sorted({k for d in self.pa for k in d}):
            at = me.attributes.new(key, "FLOAT", "POINT")
            at.data.foreach_set("value", [float(d.get(key, 0.0)) for d in self.pa])
        if smooth: me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
        ob = put(bpy.data.objects.new(name, me), coll)
        if bevel:
            md = ob.modifiers.new("edge", "BEVEL"); md.width = bevel; md.segments = 2; md.limit_method = "ANGLE"
        return ob


def cylinder(name, x, y, z0, z1, r, mat, seg=24, coll=None):
    v, f = [], []
    for i in range(seg):
        a = math.tau * i / seg
        v += [(x + r * math.cos(a), y + r * math.sin(a), z0), (x + r * math.cos(a), y + r * math.sin(a), z1)]
    for i in range(seg):
        j = (i + 1) % seg
        f.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    f.append(tuple(2 * i for i in reversed(range(seg)))); f.append(tuple(2 * i + 1 for i in range(seg)))
    me = bpy.data.meshes.new(name); me.from_pydata(v, [], f); me.update(); me.materials.append(mat)
    for p in me.polygons: p.use_smooth = True
    return put(bpy.data.objects.new(name, me), coll)


# ── GN: 속성 fl(층)+an(둘레 위치)이 R보다 작은 면만 남긴다 ─────────────
def reveal_group():
    ng = bpy.data.node_groups.new("reveal", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    sR = ng.interface.new_socket("R", in_out="INPUT", socket_type="NodeSocketFloat")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N, L = ng.nodes, ng.links
    gi = N.new("NodeGroupInput"); go = N.new("NodeGroupOutput")
    fl = N.new("GeometryNodeInputNamedAttribute"); fl.data_type = "FLOAT"; fl.inputs["Name"].default_value = "fl"
    an = N.new("GeometryNodeInputNamedAttribute"); an.data_type = "FLOAT"; an.inputs["Name"].default_value = "an"
    key = N.new("ShaderNodeMath"); key.operation = "MULTIPLY_ADD"
    L.new(an.outputs["Attribute"], key.inputs[0]); key.inputs[1].default_value = .999; L.new(fl.outputs["Attribute"], key.inputs[2])
    age = N.new("ShaderNodeMath"); age.operation = "SUBTRACT"
    L.new(gi.outputs[sR.identifier], age.inputs[0]); L.new(key.outputs[0], age.inputs[1])
    st = N.new("GeometryNodeStoreNamedAttribute"); st.data_type = "FLOAT"; st.domain = "FACE"; st.inputs["Name"].default_value = "age"
    L.new(gi.outputs[0], st.inputs["Geometry"]); L.new(age.outputs[0], st.inputs["Value"])
    lt = N.new("ShaderNodeMath"); lt.operation = "LESS_THAN"; lt.inputs[1].default_value = 1e-4
    L.new(age.outputs[0], lt.inputs[0])
    dl = N.new("GeometryNodeDeleteGeometry"); dl.domain = "FACE"
    L.new(st.outputs["Geometry"], dl.inputs["Geometry"]); L.new(lt.outputs[0], dl.inputs["Selection"])
    L.new(dl.outputs["Geometry"], go.inputs[0])
    return ng, sR.identifier


REVEAL, REVEAL_ID = reveal_group()


def reveal(ob, fn, f0=0, f1=LAST):
    md = ob.modifiers.new("reveal", "NODES"); md.node_group = REVEAL
    try: ob.cycles.use_deform_motion = False
    except Exception: pass
    # Blender 5.x: 노드 모디파이어 입력은 properties.inputs.<식별자>.value에 있다.
    bake(ob, f'modifiers["reveal"].properties.inputs.{REVEAL_ID}.value', fn_samples(fn, f0, f1))
    return ob


# ── 타워 형상 ─────────────────────────────────────────────────────────
def squircle(n=M, a=1.0, e=SQN):
    """둘레 길이가 같도록 다시 뽑은 초타원 점과 바깥 법선. 시작은 남쪽(-Y) 가운데."""
    dense = []
    K = 6000
    for i in range(K + 1):
        t = -math.pi / 2 + i / K * math.tau
        c, s = math.cos(t), math.sin(t)
        dense.append(Vector((a * math.copysign(abs(c) ** (2 / e), c), a * math.copysign(abs(s) ** (2 / e), s), 0)))
    acc = [0.0]
    for p, q in zip(dense, dense[1:]): acc.append(acc[-1] + (q - p).length)
    total = acc[-1]
    pts, j = [], 0
    for i in range(n):
        target = total * i / n
        while acc[j + 1] < target: j += 1
        t = (target - acc[j]) / max(1e-9, acc[j + 1] - acc[j])
        pts.append(dense[j].lerp(dense[j + 1], t))
    nrm = []
    for i in range(n):
        tng = (pts[(i + 1) % n] - pts[i - 1]).normalized()
        nrm.append(Vector((tng.y, -tng.x, 0)))
    return pts, nrm


BASE, BASE_N = squircle()


def outline(k, inset=0.0):
    """k층의 둘레(월드 좌표, z=0)와 법선."""
    s, r = floor_scale(k), floor_rot(k)
    R = Matrix.Rotation(r, 3, "Z")
    return [R @ (p * (HALF * s - inset) / 1.0) for p in BASE], [R @ n for n in BASE_N]


def core_hit(d):
    """중심에서 방향 d로 나간 선이 코어 외벽(반폭 CORE)과 만나는 점."""
    t = CORE / max(abs(d.x), abs(d.y), 1e-6)
    return Vector((d.x * t, d.y * t, 0))


def build_tower():
    zk = lambda k: PL + k * FH
    # 코어: 층마다 네 벽의 안팎(속이 빈 샤프트)
    b = Builder(CONCRETE)
    t = .6
    for k in range(NF + 2):
        z0, z1 = zk(k) - (PL + 2.0 if k == 0 else 0), zk(k + 1)
        for x0, x1, y0, y1 in ((-CORE, CORE, -CORE, -CORE + t), (-CORE, CORE, CORE - t, CORE), (-CORE, -CORE + t, -CORE + t, CORE - t), (CORE - t, CORE, -CORE + t, CORE - t)):
            b.box(x0, x1, y0, y1, z0, z1, fl=k)
    core = reveal(b.build("core"), core_floors)

    # 기둥: 코어 둘레의 12개, 층마다 한 토막
    b = Builder(STEEL)
    for k in range(NF):
        for i in range(NCOL):
            a = math.tau * (i + .5) / NCOL
            x, y = COLR * math.cos(a), COLR * math.sin(a)
            b.box(x - .55, x + .55, y - .55, y + .55, zk(k) + .4, zk(k + 1), fl=k, an=.2)
    cols = reveal(b.build("columns"), lambda f: min(NF, slabs(f) + .6 * clamp01(slabs(f))))

    # 슬래브: 층마다 초타원 판(가장자리가 스캔 빛을 받는다)
    b = Builder(SLABCON)
    for k in range(NF + 1):
        pts, _ = outline(min(k, NF - 1), inset=.15)
        z0, z1 = zk(k), zk(k) + .4
        for i in range(M):
            p, q = pts[i], pts[(i + 1) % M]
            b.quad([(p.x, p.y, z1), (0, 0, z1), (q.x, q.y, z1)], fl=k)
            b.quad([(q.x, q.y, z0), (0, 0, z0), (p.x, p.y, z0)], fl=k)
            b.quad([(p.x, p.y, z0), (q.x, q.y, z0), (q.x, q.y, z1), (p.x, p.y, z1)], fl=k)
    slab = reveal(b.build("slabs"), slabs)

    # 외피: 유리, 층간 스팬드럴, 수직 핀. 둘레를 따라 한 바퀴 돌며 설치된다(an).
    b = Builder(CURTAIN, SPANDREL, FIN)
    for k in range(NF):
        pts, nrm = outline(k)
        z0 = zk(k)
        for i in range(M):
            p, q = pts[i], pts[(i + 1) % M]
            n0, n1 = nrm[i], nrm[(i + 1) % M]
            an = i / M
            b.quad([(p.x, p.y, z0 + .65), (q.x, q.y, z0 + .65), (q.x, q.y, z0 + FH - .55), (p.x, p.y, z0 + FH - .55)], 0, fl=k, an=an)
            po, qo = p + n0 * .12, q + n1 * .12
            zs0, zs1 = z0 - .55, z0 + .65
            b.quad([(po.x, po.y, zs0), (qo.x, qo.y, zs0), (qo.x, qo.y, zs1), (po.x, po.y, zs1)], 1, fl=k, an=an)
            b.quad([(p.x, p.y, zs1), (q.x, q.y, zs1), (qo.x, qo.y, zs1), (po.x, po.y, zs1)], 1, fl=k, an=an)
            b.quad([(po.x, po.y, zs0), (qo.x, qo.y, zs0), (q.x, q.y, zs0), (p.x, p.y, zs0)], 1, fl=k, an=an)
            if i % 2 == 0:
                c = p + n0 * .52
                tng = Vector((-n0.y, n0.x, 0))
                b.obox((c.x, c.y, z0 + FH / 2 - .55), n0, tng, (0, 0, 1), .44, .07, FH / 2, 2, fl=k, an=an)
    skin = reveal(b.build("curtain wall"), facade)

    # 안전 스크린: 방금 놓인 세 층을 둘러싸고 슬래브와 함께 오른다(고층 현장의 자동 상승 방호벽)
    b = Builder(SCREEN, SCREEN_BAND)
    pts, nrm = outline(NF - 6)
    for i in range(M):
        p, q = pts[i] + nrm[i] * 1.05, pts[(i + 1) % M] + nrm[(i + 1) % M] * 1.05
        b.quad([(p.x, p.y, -2 * FH - 1.2), (q.x, q.y, -2 * FH - 1.2), (q.x, q.y, 1.8), (p.x, p.y, 1.8)], 0)
        b.quad([(p.x, p.y, 1.8), (q.x, q.y, 1.8), (q.x, q.y, 2.3), (p.x, p.y, 2.3)], 1)
        b.quad([(p.x, p.y, -2 * FH - 1.7), (q.x, q.y, -2 * FH - 1.7), (q.x, q.y, -2 * FH - 1.2), (p.x, p.y, -2 * FH - 1.2)], 1)
    scr = b.build("safety screen")
    rot = []
    for f in ALL:
        k = slabs(f)
        scr.location.z = 0
        rot.append(floor_rot(max(0, k - 1)))
    bake(scr, "location", [(f, slab_top(f)) for f in ALL], index=2)
    bake(scr, "rotation_euler", [(f, rot[n] - floor_rot(NF - 6)) for n, f in enumerate(ALL)], index=2)
    bake(scr, "scale", [(f, floor_scale(max(0, slabs(f) - 1)) / floor_scale(NF - 6)) for f in ALL], index=0)
    bake(scr, "scale", [(f, floor_scale(max(0, slabs(f) - 1)) / floor_scale(NF - 6)) for f in ALL], index=1)
    visible_between(scr, 206, 412)
    prop(scr, "on", [(0, 1), (LAST, 1)], 1.0)

    # 실내: 천장(켜지는 면)과 바닥. 외피와 함께 채워진다.
    b = Builder(CEILING)
    fb = Builder(IFLOOR)
    for k in range(NF):
        pts, _ = outline(k, inset=.9)
        zc, zf = zk(k) + FH - .5, zk(k) + .42
        for i in range(M):
            p, q = pts[i], pts[(i + 1) % M]
            cp, cq = core_hit(p), core_hit(q)
            b.quad([(p.x, p.y, zc), (cp.x, cp.y, zc), (cq.x, cq.y, zc), (q.x, q.y, zc)], fl=k, an=i / M)
            fb.quad([(q.x, q.y, zf), (cq.x, cq.y, zf), (cp.x, cp.y, zf), (p.x, p.y, zf)], fl=k, an=i / M)
    ceil = reveal(b.build("ceilings"), facade)
    flo = reveal(fb.build("interior floors"), facade)
    for ob in (ceil, flo):
        prop(ob, "wave", fn_samples(wave, 490, 580))

    # 왕관: 핀만 계속 비틀며 올라가 안쪽에서 빛난다
    b = Builder(FIN, CROWN_GLOW)
    for j in range(CROWN):
        k = NF + j
        s = floor_scale(NF - 1) * (1 - .055 * (j + 1))
        R = Matrix.Rotation(floor_rot(k), 3, "Z")
        z0 = zk(k)
        for i in range(0, M, 2):
            p = R @ (BASE[i] * HALF * s); n0 = R @ BASE_N[i]
            c = p + n0 * .42
            tng = Vector((-n0.y, n0.x, 0))
            b.obox((c.x, c.y, z0 + FH / 2 - .45), n0, tng, (0, 0, 1), .34, .055, FH / 2, 0, fl=j, an=i / M)
            ci = p - n0 * .02
            b.obox((ci.x, ci.y, z0 + FH / 2 - .45), n0, tng, (0, 0, 1), .02, .05, FH / 2 - .3, 1, fl=j, an=i / M)
    cr = reveal(b.build("crown"), crown)
    prop(cr, "lit", [(0, 0), (556, 0), *[(f, ramp(f, 556, 584)) for f in span(556, 584)], (LAST, 1)])
    roof = Builder(SLABCON, CRANE_DARK)
    pts, _ = outline(NF - 1, inset=.4)
    zr = zk(NF) + .4
    for i in range(M):
        p, q = pts[i], pts[(i + 1) % M]
        roof.quad([(p.x, p.y, zr), (0, 0, zr), (q.x, q.y, zr)])
    roof.box(-6, 6, -6, 6, zr, zr + 7, 1)
    roof = roof.build("roof")
    hide_until(roof, 404)
    beacon = Builder(AVIATION).box(-.4, .4, -.4, .4, zk(NF + CROWN) - .2, zk(NF + CROWN) + .6).build("tower beacon")
    hide_until(beacon, 486)
    prop(beacon, "on", [(0, 1), (LAST, 1)], 1.0)

    # 로비 캐노피(남쪽 입구)
    cano = Builder(SPANDREL, LED)
    cano.box(-14, 14, -27, -18.5, 7.2, 7.6, 0)
    for x in range(-12, 13, 4):
        cano.box(x - .3, x + .3, -25.5, -20, 7.18, 7.2, 1)
    cano = cano.build("canopy")
    hide_until(cano, 470)
    prop(cano, "lit", [(0, 0), (506, 0), (526, 1), (LAST, 1)])
    return dict(core=core, slab=slab, skin=skin)


# ── 기초 ─────────────────────────────────────────────────────────────
PILES = []


def build_foundation():
    # 말뚝 배치: 코어 아래 격자 + 기둥 아래 고리
    for gx in (-6, -2, 2, 6):
        for gy in (-6, -2, 2, 6):
            PILES.append((gx, gy))
    for i in range(NCOL * 2):
        a = math.tau * (i + .5) / (NCOL * 2)
        PILES.append((15.5 * math.cos(a), 15.5 * math.sin(a)))
    dots = Builder(LINE_DIM)
    caps = []
    for n, (x, y) in enumerate(PILES):
        for k in range(24):
            a0, a1 = math.tau * k / 24, math.tau * (k + 1) / 24
            dots.quad([(x, y, .05), (x + 1.1 * math.cos(a0), y + 1.1 * math.sin(a0), .05), (x + 1.1 * math.cos(a1), y + 1.1 * math.sin(a1), .05)])
    dots = dots.build("pile marks")
    prop(dots, "fade", [(0, 0), (98, 0), (112, 1.0), (150, 1.0), (170, .0), (LAST, 0)])
    pc = Builder(RAFT)
    for x, y in PILES:
        pc.box(x - .8, x + .8, y - .8, y + .8, -1.5, 0)
    pc = pc.build("pile caps")
    pc.location.z = -1.6
    bake(pc, "location", [(f, -1.6 + 1.9 * ramp(f, 108, 132, ease_out)) for f in sorted({0, *span(108, 132), LAST})], index=2)
    hide_until(pc, 108)
    # 매트 기초: 초타원, 아래에서 차오른다
    b = Builder(RAFT)
    pts, _ = squircle(64, 26.0)
    z0, z1 = -2.4, PL - .02
    for i in range(64):
        p, q = pts[i], pts[(i + 1) % 64]
        b.quad([(p.x, p.y, z1), (0, 0, z1), (q.x, q.y, z1)])
        b.quad([(p.x, p.y, z0), (q.x, q.y, z0), (q.x, q.y, z1), (p.x, p.y, z1)])
    raft = b.build("raft")
    raft.location.z = -2.7
    bake(raft, "location", [(f, -2.7 * (1 - ramp(f, 128, 166, ease_out))) for f in sorted({0, *span(128, 166), LAST})], index=2)
    hide_until(raft, 128)


# ── 측량선 ───────────────────────────────────────────────────────────
class Lines:
    """길이 방향 u와 그려지는 구간(t0, t1)을 가진 선 묶음."""
    def __init__(self):
        self.b = Builder(LINE)

    def poly(self, pts, t0, t1, width=.09, z=.06, closed=False, dash=None):
        pts = [Vector((p[0], p[1], 0)) for p in pts]
        if closed: pts = pts + [pts[0]]
        acc = [0.0]
        for p, q in zip(pts, pts[1:]): acc.append(acc[-1] + (q - p).length)
        total = acc[-1] or 1
        for i, (p, q) in enumerate(zip(pts, pts[1:])):
            d = q - p; n = d.length
            if n < 1e-6: continue
            nx, ny = -d.y / n * width / 2, d.x / n * width / 2
            segs = [(0.0, 1.0)]
            if dash:
                segs, s = [], 0.0
                while s < n:
                    segs.append((s / n, min(n, s + dash[0]) / n)); s += dash[0] + dash[1]
            for a, c in segs:
                pa_ = p.lerp(q, a); pc_ = p.lerp(q, c)
                ua, uc = (acc[i] + a * n) / total, (acc[i] + c * n) / total
                self.b.quad([(pa_.x + nx, pa_.y + ny, z), (pa_.x - nx, pa_.y - ny, z), (pc_.x - nx, pc_.y - ny, z), (pc_.x + nx, pc_.y + ny, z)],
                            pa=[{"u": ua}, {"u": ua}, {"u": uc}, {"u": uc}], t0=t0, t1=t1)

    def circle(self, c, r, t0, t1, width=.07, seg=48):
        self.poly([(c[0] + r * math.cos(-math.pi / 2 + math.tau * i / seg), c[1] + r * math.sin(-math.pi / 2 + math.tau * i / seg)) for i in range(seg)], t0, t1, width, closed=True)

    def build(self, name, fade):
        ob = self.b.build(name)
        prop(ob, "clock", [(0, 0), (LAST, LAST)])
        prop(ob, "fade", fade)
        return ob


GRID_X = [-24, -12, 0, 12, 24]
GRID_Y = [-24, -12, 0, 12, 24]
SITE = (-62, -52, 62, 58)
FIRST_LINE = [(INSTR.x, INSTR.y), (-54.0, 50.0)]


def build_survey():
    fade = [(0, 1.0), (126, 1.0), (170, .42), (440, .32), (470, 0.0), (LAST, 0)]
    first = Lines()
    first.poly(FIRST_LINE, -60, -20, width=.55)
    first.build("first line", [(0, 1.0), (96, 1.0), (170, .42), (440, .32), (470, 0.0), (LAST, 0)])
    L = Lines()
    x0, y0, x1, y1 = SITE
    L.poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], 4, 42, width=.26, closed=True)
    for n, gx in enumerate(GRID_X):
        L.poly([(gx, -40), (gx, 40)], 18 + n * 3, 40 + n * 3, width=.12, dash=(2.4, .8))
        L.circle((gx, -42.4), 1.9, 36 + n * 3, 50 + n * 3, width=.13)
    for n, gy in enumerate(GRID_Y):
        L.poly([(-40, gy), (40, gy)], 22 + n * 3, 44 + n * 3, width=.12, dash=(2.4, .8))
        L.circle((-42.4, gy), 1.9, 40 + n * 3, 54 + n * 3, width=.13)
    # 기준층 외곽선, 코어, 최상층 외곽선(비틀림의 의도)
    pts, _ = outline(0)
    L.poly([(p.x, p.y) for p in pts], 46, 84, width=.24, closed=True)
    L.poly([(-CORE, -CORE), (CORE, -CORE), (CORE, CORE), (-CORE, CORE)], 54, 74, width=.18, closed=True)
    top, _ = outline(NF - 1)
    L.poly([(p.x, p.y) for p in top], 62, 92, width=.13, closed=True, dash=(1.2, .7))
    for i in range(NCOL):
        a = math.tau * (i + .5) / NCOL
        L.circle((COLR * math.cos(a), COLR * math.sin(a)), .7, 70 + i, 78 + i, width=.1, seg=20)
    # 치수선
    L.poly([(-HALF, -33), (HALF, -33)], 76, 90, width=.09)
    for x in (-HALF, HALF):
        L.poly([(x, -31.5), (x, -34.5)], 74, 80, width=.09)
    L.poly([(33, -HALF), (33, HALF)], 78, 92, width=.09)
    for y in (-HALF, HALF):
        L.poly([(31.5, y), (34.5, y)], 76, 82, width=.09)
    L.build("survey plan", fade)
    # 축 기호(글자)
    for n, gx in enumerate(GRID_X):
        letter("ABCDE"[n], (gx, -42.4), 44 + n * 3)
    for n, gy in enumerate(GRID_Y):
        letter("12345"[n], (-42.4, gy), 48 + n * 3)


def letter(ch, at, f0):
    cu = bpy.data.curves.new(f"axis {ch}", "FONT")
    cu.body = ch; cu.size = 2.0; cu.align_x = "CENTER"; cu.align_y = "CENTER"
    m = fade_mat(f"axis {ch}", CYAN, 7.0)
    cu.materials.append(m)
    ob = put(bpy.data.objects.new(f"axis {ch}", cu))
    ob.location = (at[0], at[1], .07)
    prop(ob, "fade", [(0, 0), (f0, 0), (f0 + 10, 1.0), (126, 1.0), (170, .42), (440, .32), (470, 0.0), (LAST, 0)])


def build_instrument():
    """토탈스테이션: 삼각대와 기계. 레이저가 방금 놓인 층의 모서리를 짚는다."""
    b = Builder(CRANE_DARK, CRANE, AVIATION)
    top = INSTR + Vector((0, 0, 1.45))
    for i in range(3):
        a = math.tau * i / 3 + .3
        foot = INSTR + Vector((.75 * math.cos(a), .75 * math.sin(a), 0))
        b.strut(foot, top, .05)
    b.box(top.x - .16, top.x + .16, top.y - .12, top.y + .12, top.z, top.z + .34, 1)
    b.box(top.x - .07, top.x + .07, top.y - .2, top.y + .2, top.z + .14, top.z + .26, 0)
    b.build("total station")
    src = top + Vector((0, 0, .2))
    beam = cylinder("laser beam", 0, 0, 0, 1, .045, BEAM, seg=8)
    dot = Builder(BEAM).box(-.35, .35, -.35, .35, -.35, .35).build("laser dot")
    beam.rotation_mode = "QUATERNION"
    locs, quats, scales, on = [], [], [], []
    frames = ALL
    for f in frames:
        k = max(0.0, slabs(f))
        kk = min(NF - 1, int(k))
        pts, _ = outline(kk)
        # 기계에 가장 가까운 모서리
        best = min(pts, key=lambda p: (p - Vector((INSTR.x, INSTR.y, 0))).length)
        target = Vector((best.x, best.y, PL + k * FH + .4))
        d = target - src
        locs.append(src); quats.append(d.to_track_quat("Z", "Y")); scales.append(d.length)
        on.append(ramp(f, 196, 214) * (1 - ramp(f, 404, 420)))
    for i in range(3):
        bake(beam, "location", [(f, locs[n][i]) for n, f in enumerate(frames)], index=i)
    for i in range(4):
        bake(beam, "rotation_quaternion", [(f, quats[n][i]) for n, f in enumerate(frames)], index=i)
    bake(beam, "scale", [(f, scales[n]) for n, f in enumerate(frames)], index=2)
    for i in range(3):
        bake(dot, "location", [(f, (locs[n] + quats[n] @ Vector((0, 0, scales[n])))[i]) for n, f in enumerate(frames)], index=i)
    for ob in (beam, dot):
        prop(ob, "on", list(zip(frames, on)))


# ── 크레인 ───────────────────────────────────────────────────────────
MAST = 54.0
JIB = 62.0


def crane_seat(f):
    """마스트 밑동의 높이. 코어 안에 묻혀 코어와 함께 오르고, 준공 무렵 코어 안으로 내려간다."""
    rise = -64 * (1 - ramp(f, 150, 188, ease_out))
    down = -150 * ramp(f, 432, 462, ease_in)
    return core_top(f) - 10 + rise + down


def crane_slew(f):
    return math.radians(piece([(0, 212), (192, 212), (246, 168), (300, 150), (360, 205), (408, 232), (LAST, 232)], f))


def build_crane():
    root = put(bpy.data.objects.new("crane", None))
    head = put(bpy.data.objects.new("crane slew", None))
    head.parent = root; head.location = (0, 0, MAST)
    # 마스트: 2.2 m 격자
    m = Builder(CRANE)
    w = 1.1
    corners = [Vector((sx * w, sy * w, 0)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    seg = 4.0
    for c in corners:
        m.strut(c, c + Vector((0, 0, MAST)), .2)
    z = 0.0
    while z < MAST - .1:
        for i in range(4):
            a, c = corners[i], corners[(i + 1) % 4]
            m.strut(a + Vector((0, 0, z)), c + Vector((0, 0, z)), .1)
            if (int(z / seg) + i) % 2 == 0:
                m.strut(a + Vector((0, 0, z)), c + Vector((0, 0, z + seg)), .08)
            else:
                m.strut(c + Vector((0, 0, z)), a + Vector((0, 0, z + seg)), .08)
        z += seg
    mast = m.build("crane mast")
    mast.parent = root
    # 선회부: 운전실, 탑 헤드, 지브, 카운터 지브
    h = Builder(CRANE, CRANE_DARK, COUNTERWT, AVIATION)
    h.box(-1.6, 1.6, -1.6, 1.6, 0, 1.4, 1)
    h.box(1.2, 3.2, 1.2, 3.0, .2, 2.6, 1)
    apex = Vector((0, 0, 12.5))
    for c in corners:
        h.strut(c + Vector((0, 0, 1.4)), apex, .16)
    # 지브: 삼각 단면
    jb = [Vector((0, -.85, 1.4)), Vector((0, .85, 1.4)), Vector((0, 0, 3.2))]
    x = 0.0; step = 3.1; n = 0
    while x < JIB - .1:
        x1 = min(JIB, x + step)
        for i in range(3):
            h.strut(jb[i] + Vector((x, 0, 0)), jb[i] + Vector((x1, 0, 0)), .14)
        for i in range(3):
            a, c = jb[i], jb[(i + 1) % 3]
            if n % 2 == 0: h.strut(a + Vector((x, 0, 0)), c + Vector((x1, 0, 0)), .07)
            else: h.strut(c + Vector((x, 0, 0)), a + Vector((x1, 0, 0)), .07)
        x = x1; n += 1
    # 카운터 지브와 평형추
    h.box(-22, 0, -1.2, -1.0, 1.2, 1.6, 0).box(-22, 0, 1.0, 1.2, 1.2, 1.6, 0)
    for xx in range(-22, 0, 2):
        h.box(xx - .05, xx + .05, -1.2, 1.2, 1.2, 1.4, 0)
    h.box(-22, -15, -1.1, 1.1, -1.6, 1.2, 2)
    # 타이 바
    h.strut(apex, jb[2] + Vector((40, 0, 0)), .06).strut(apex, jb[2] + Vector((22, 0, 0)), .06)
    h.strut(apex, Vector((-21, 0, 1.6)), .08)
    # 트롤리와 훅, 매단 커튼월 유닛
    tx = 34.0
    h.box(tx - 1, tx + 1, -.9, .9, 1.0, 1.4, 1)
    h.strut(Vector((tx, -.2, 1.0)), Vector((tx, -.2, -22)), .05).strut(Vector((tx, .2, 1.0)), Vector((tx, .2, -22)), .05)
    h.box(tx - .4, tx + .4, -.4, .4, -23, -22, 1)
    h.box(tx - 2.2, tx + 2.2, -.35, .35, -27.2, -23.2, 0)
    # 항공 장애등
    for p in (apex, jb[2] + Vector((JIB, 0, 0)), Vector((-22, 0, 1.6))):
        h.box(p.x - .3, p.x + .3, p.y - .3, p.y + .3, p.z, p.z + .6, 3)
    hd = h.build("crane head")
    hd.parent = head
    prop(hd, "on", [(0, 1), (LAST, 1)], 1.0)
    lights = Builder(WORKLIGHT)
    for yy in (-1.3, 1.3):
        lights.box(3.4, 3.6, yy - .15, yy + .15, .5, .8)
    lights = lights.build("crane lamps")
    lights.parent = head
    prop(lights, "on", [(0, 0), (300, .3), (408, 1), (LAST, 1)])
    root.location = (3.2, 1.0, 0)
    fr = ALL
    bake(root, "location", [(f, crane_seat(f)) for f in fr], index=2)
    bake(head, "rotation_euler", [(f, crane_slew(f)) for f in fr], index=2)
    # 해체: 지브와 카운터 지브를 마스트 쪽으로 거둔 뒤 마스트가 코어 안으로 내려간다
    bake(head, "scale", [(f, max(.02, 1 - ramp(f, 412, 434))) for f in sorted({0, *span(412, 434), LAST})], index=0)
    for ob in (mast, hd, lights):
        visible_between(ob, 150, 462)
    return root


def build_jumpform():
    b = Builder(FORMWORK, WORKLIGHT)
    o, i_ = CORE + .9, CORE - .2
    zb, zt = -6.0, 2.2
    for x0, x1, y0, y1 in ((-o, o, -o, -i_), (-o, o, i_, o), (-o, -i_, -i_, i_), (i_, o, -i_, i_)):
        b.box(x0, x1, y0, y1, zb, zt)
    for s in (-1, 1):
        for x in (-6, -2, 2, 6):
            b.box(x - .35, x + .35, s * (o + .02) - .02, s * (o + .02) + .02, zt - .5, zt - .3, 1)
            b.box(s * (o + .02) - .02, s * (o + .02) + .02, x - .35, x + .35, zt - .5, zt - .3, 1)
    ob = b.build("jump form")
    bake(ob, "location", [(f, core_top(f)) for f in ALL], index=2)
    visible_between(ob, 168, 432)
    prop(ob, "on", [(0, 0), (280, .4), (408, 1), (LAST, 1)])


# ── 광장 ─────────────────────────────────────────────────────────────
TREE_MESHES = []
GROW = []


def build_plaza():
    x0, y0, x1, y1 = SITE
    b = Builder(PAVING)
    step = 3.0
    y = y0
    while y < y1 - .01:
        x = x0
        while x < x1 - .01:
            cx, cy = x + step / 2, y + step / 2
            in_pool = abs(cx) < 18 and -41 < cy < -33
            if not in_pool:
                d = math.hypot(cx, cy) / 90.0
                b.box(x + .02, x + step - .02, y + .02, y + step - .02, PL - .12, PL, fl=0, an=0, d=d)
            x += step
        y += step
    me = b.build("plaza paving")
    # 포장은 타워에서 바깥으로 퍼진다: fl 대신 거리(d)를 쓰기 위해 속성 이름을 바꿔 쓴다
    at = me.data.attributes["fl"]; dd = me.data.attributes["d"]
    at.data.foreach_set("value", [v.value for v in dd.data])
    reveal(me, paving, 440, 500)
    # 반사 연못
    pool = Builder(COPING, POOLWATER)
    pool.box(-18.4, 18.4, -41.4, -40.8, 0, PL + .06, 0).box(-18.4, 18.4, -33.2, -32.6, 0, PL + .06, 0)
    pool.box(-18.4, -17.8, -41.4, -32.6, 0, PL + .06, 0).box(17.8, 18.4, -41.4, -32.6, 0, PL + .06, 0)
    pool.quad([(-17.8, -40.8, PL - .05), (17.8, -40.8, PL - .05), (17.8, -33.2, PL - .05), (-17.8, -33.2, PL - .05)], 1)
    pool = pool.build("reflecting pool")
    hide_until(pool, 470)
    led = Builder(LED)
    for yy in (-42.0, -32.0):
        led.box(-18, 18, yy - .05, yy + .05, PL - .005, PL + .005)
    for xx in (-44, -30, 30, 44):
        led.box(xx - .05, xx + .05, -48, 50, PL - .005, PL + .005)
    led = led.build("plaza led lines")
    hide_until(led, 470)
    prop(led, "lit", [(0, 0), (504, 0), (530, 1), (LAST, 1)])
    # 광장 나무
    spots = [(-37, -26), (-37, -12), (-37, 2), (-37, 16), (37, -26), (37, -12), (37, 2), (37, 16), (-24, 34), (-8, 36), (8, 36), (24, 34),
             (-52, -44), (52, -44)]
    for i, (x, y) in enumerate(spots):
        t = tree_at(f"plaza tree {i}", x, y, 1.0 + .12 * ((i * 7) % 3), i * 1.7, kind=2 if i % 3 else 1)
        GROW.append((t, 468 + (i % 7) * 3, t.scale.x))


def tree_template(i, coll):
    r = random.Random(40 + i)
    parts = [cylinder(f"trunk {i}", 0, 0, 0, 2.2 if i < 2 else 4.2, .12 if i < 2 else .17, BARK, seg=10, coll=coll)]
    if i < 2:
        height = 10.5 if i == 0 else 8.2
        n = 16
        for k in range(n):
            t = k / (n - 1)
            rad = (1.2 if i == 0 else 1.0) * (1 - .8 * t ** 1.6) * (1 - .25 * (1 - t) ** 6)
            c = (r.uniform(-.1, .1), r.uniform(-.1, .1), 1.4 + t * (height - 2.0))
            parts.append(blob(f"crown {i}.{k}", c, max(.22, rad), LEAF, coll=coll, squash=1.25))
    else:
        for k in range(15):
            a = r.uniform(0, math.tau); d = r.uniform(0, 2.4)
            c = (d * math.cos(a), d * math.sin(a), r.uniform(4.2, 7.4) - d * .35)
            parts.append(blob(f"crown {i}.{k}", c, r.uniform(.75, 1.25), LEAF, coll=coll, squash=.78))
    dg = bpy.context.evaluated_depsgraph_get()
    verts, faces, mats = [], [], []
    for ob in parts:
        ev = ob.evaluated_get(dg); me = ev.to_mesh()
        o = len(verts)
        verts += [tuple(ob.matrix_world @ v.co) for v in me.vertices]
        leaf = ob.name.startswith("crown")
        for p in me.polygons:
            faces.append(tuple(o + i for i in p.vertices)); mats.append(1 if leaf else 0)
        ev.to_mesh_clear()
    me = bpy.data.meshes.new(f"tree {i}")
    me.from_pydata(verts, [], faces); me.update()
    me.materials.append(BARK); me.materials.append(LEAF)
    me.polygons.foreach_set("material_index", mats); me.polygons.foreach_set("use_smooth", [True] * len(faces))
    return me


def blob(name, center, radius, mat, coll=None, squash=1.0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=radius, location=center)
    ob = bpy.context.object; ob.name = name
    ob.scale = (1, 1, squash)
    tex = bpy.data.textures.new(f"{name} lumps", "CLOUDS"); tex.noise_scale = .55 * radius; tex.noise_depth = 2
    md = ob.modifiers.new("lumps", "DISPLACE"); md.texture = tex; md.strength = .45 * radius; md.mid_level = .5
    md.texture_coords = "OBJECT"
    ob.data.materials.append(mat)
    if coll is not None:
        for c in list(ob.users_collection): c.objects.unlink(ob)
        coll.objects.link(ob)
    return ob


def tree_at(name, x, y, s, rot, kind=None, z=0.0):
    k = kind if kind is not None else (2 if zlib.crc32(name.encode()) % 10 < 7 else zlib.crc32(name.encode()) % 2)
    ob = put(bpy.data.objects.new(name, TREE_MESHES[k]))
    ob.location = (x, y, z); ob.scale = (s, s, s); ob.rotation_euler = (0, 0, rot)
    return ob


# ── 땅과 강 ───────────────────────────────────────────────────────────
RIVER_S, RIVER_N = 84.0, 470.0


def build_ground():
    hidden = bpy.data.collections.new("tree templates"); S.collection.children.link(hidden)
    hidden.hide_render = True; hidden.hide_viewport = True
    for i in range(3):
        TREE_MESHES.append(tree_template(i, hidden))
    E = 6000
    ground = textured("bank ground", (.016, .026, .012), (.04, .055, .026), rough=.95, scale=.06, bump=.2, variation=False, coords="World")
    Builder(ground).quad([(-E, -E, 0), (E, -E, 0), (E, RIVER_S - 22, 0), (-E, RIVER_S - 22, 0)]).build("south ground")
    Builder(ground).quad([(-E, RIVER_N, 0), (E, RIVER_N, 0), (E, E, 0), (-E, E, 0)]).build("north ground")
    # 강변 산책로와 제방
    Builder(PAVING).box(-E, E, RIVER_S - 22, RIVER_S, -.2, PL).build("promenade")
    Builder(EMBANK).box(-E, E, RIVER_S - .6, RIVER_S, -4, PL).box(-E, E, RIVER_N, RIVER_N + .6, -4, PL).build("embankments")
    Builder(RIVER).quad([(-E, RIVER_S - .6, -1.6), (E, RIVER_S - .6, -1.6), (E, RIVER_N + .6, -1.6), (-E, RIVER_N + .6, -1.6)]).build("river")
    # 대지(자갈)와 남쪽 도로
    x0, y0, x1, y1 = SITE
    Builder(GRAVEL).box(x0, x1, y0, y1, -.1, .02).build("site lot")
    Builder(ASPHALT).box(-E, E, -72, -56, -.1, .04).build("south road")
    marks = Builder(emissive("road marks", (.7, .7, .66), .25, attr="on"))
    x = -900.0
    while x < 900:
        marks.box(x, x + 3, -64.1, -63.9, .04, .045); x += 9
    marks = marks.build("road marks")
    prop(marks, "on", [(0, 1), (LAST, 1)], 1.0)
    # 가로등(남쪽 도로, 강변)
    lamps = Builder(CRANE_DARK, STREET)
    for x in range(-420, 421, 28):
        for y, face in ((-73.5, 1), (RIVER_S - 4, -1)):
            if y < 0 and abs(x) < 90: continue
            lamps.box(x - .1, x + .1, y - .1, y + .1, 0, 7.5, 0)
            lamps.box(x - .35, x + .35, y - .5 * face - .35, y - .5 * face + .35, 7.3, 7.5, 0)
            lamps.box(x - .3, x + .3, y - .5 * face - .3, y - .5 * face + .3, 7.28, 7.3, 1)
    lamps = lamps.build("street lamps")
    prop(lamps, "lit", [(0, 0), (470, 0), (510, 1), (LAST, 1)])
    # 강변 나무
    r = random.Random(9)
    x = -700.0
    while x < 700:
        if abs(x) > 8:
            tree_at(f"river tree {int(x)}", x + r.uniform(-2, 2), RIVER_S - 11 + r.uniform(-3, 3), r.uniform(.9, 1.25), r.uniform(0, 6.28), z=PL)
        x += r.uniform(11, 16)
    # 먼 산 능선
    rr = random.Random(3)
    waves = [(k, amp, rr.uniform(0, math.tau)) for k, amp in ((2, 90), (5, 70), (11, 40), (23, 20), (53, 10), (131, 4))]
    ring = Builder(principled("far ridge", (.012, .014, .017), rough=1.0))
    n, R = 900, 3900.0
    for i in range(n):
        a0, a1 = i / n * math.tau, (i + 1) / n * math.tau
        h0, h1 = [30 + .7 * sum(amp * abs(math.sin(k * a + ph)) for k, amp, ph in waves) for a in (a0, a1)]
        p = lambda a, z: (R * math.cos(a), R * math.sin(a) + 300, z)
        ring.quad([p(a0, -20), p(a1, -20), p(a1, h1), p(a0, h0)])
    ring.build("far ridge")


# ── 도시 ─────────────────────────────────────────────────────────────
def building_material():
    """창은 월드 좌표 격자로 그린다(13번 장표와 같은 방식). 사무동은 층 단위, 주거동은 창 단위로 켜진다."""
    m = bpy.data.materials.new("city facade")
    N, L = tree_of(m)
    b = N["Principled BSDF"]
    geo = N.new("ShaderNodeNewGeometry"); sep = N.new("ShaderNodeSeparateXYZ"); L.new(geo.outputs["Position"], sep.inputs[0])
    nrm = N.new("ShaderNodeSeparateXYZ"); L.new(geo.outputs["Normal"], nrm.inputs[0])
    info = N.new("ShaderNodeObjectInfo")
    g = Graph(m)
    M_ = g.M

    def band(x, lo, hi): return M_("MULTIPLY", M_("GREATER_THAN", x, lo), M_("LESS_THAN", x, hi))

    def noise4(a, c, w):
        wn = N.new("ShaderNodeTexWhiteNoise"); wn.noise_dimensions = "4D"
        v = N.new("ShaderNodeCombineXYZ"); L.new(a, v.inputs[0]); L.new(c, v.inputs[1]); L.new(M_("MULTIPLY", info.outputs["Random"], 131.0), v.inputs[2])
        L.new(v.outputs[0], wn.inputs["Vector"]); wn.inputs["W"].default_value = w
        return wn.outputs["Value"]

    office, lit = g.attr("office", "OBJECT"), g.attr("lit", "OBJECT")
    night = M_("DIVIDE", M_("SUBTRACT", lit, .5), .3, clamp=True)
    zf = M_("DIVIDE", M_("SUBTRACT", sep.outputs["Z"], .22), 3.6)
    floor, fz = M_("FLOOR", zf), M_("FRACT", zf)
    ax = M_("GREATER_THAN", M_("ABSOLUTE", nrm.outputs["X"]), .5)
    u = M_("ADD", M_("MULTIPLY", ax, sep.outputs["Y"]), M_("MULTIPLY", M_("SUBTRACT", 1, ax), sep.outputs["X"]))
    uo = M_("DIVIDE", u, 1.5); colo, fo = M_("FLOOR", uo), M_("FRACT", uo)
    win_o = M_("MULTIPLY", band(fz, .1, .9), band(fo, .05, .95))
    floor_on = M_("LESS_THAN", noise4(floor, M_("MULTIPLY", colo, 0.0), 1.0), M_("SUBTRACT", M_("ADD", .3, M_("MULTIPLY", info.outputs["Random"], .4)), M_("MULTIPLY", night, .14)))
    bay_dark = M_("GREATER_THAN", noise4(floor, M_("FLOOR", M_("DIVIDE", colo, 4.0)), 2.0), .14)
    on_o = M_("MULTIPLY", floor_on, bay_dark)
    ur = M_("DIVIDE", u, 2.6); colr, fr = M_("FLOOR", ur), M_("FRACT", ur)
    win_r = M_("MULTIPLY", band(fz, .3, .8), band(fr, .2, .78))
    on_r = M_("LESS_THAN", noise4(floor, colr, 3.0), M_("SUBTRACT", M_("ADD", .16, M_("MULTIPLY", info.outputs["Random"], .26)), M_("MULTIPLY", night, .06)))
    wall = M_("MULTIPLY", M_("LESS_THAN", M_("ABSOLUTE", nrm.outputs["Z"]), .5), M_("GREATER_THAN", sep.outputs["Z"], 3.0))
    window = M_("MULTIPLY", wall, M_("ADD", M_("MULTIPLY", office, win_o), M_("MULTIPLY", M_("SUBTRACT", 1, office), win_r)))
    on = M_("ADD", M_("MULTIPLY", office, on_o), M_("MULTIPLY", M_("SUBTRACT", 1, office), on_r))
    stagger = noise4(floor, colr, 4.0)
    ready = M_("GREATER_THAN", M_("SUBTRACT", M_("MULTIPLY", lit, 1.25), M_("MULTIPLY", stagger, .25)), .5)
    glow = M_("MULTIPLY", M_("MULTIPLY", window, on), ready)
    nz5 = noise4(floor, colo, 5.0)
    bright = M_("ADD", M_("ADD", .6, M_("MULTIPLY", nz5, .8)), M_("MULTIPLY", night, M_("SUBTRACT", M_("ADD", .3, nz5), M_("ADD", .6, M_("MULTIPLY", nz5, .8)))))
    level = M_("MULTIPLY", M_("MULTIPLY", M_("ADD", M_("MULTIPLY", office, 1.5), M_("MULTIPLY", M_("SUBTRACT", 1, office), 2.2)), M_("SUBTRACT", 1, M_("MULTIPLY", night, .58))),
               M_("POWER", M_("DIVIDE", M_("SUBTRACT", lit, .3), .7, clamp=True), 1.6))
    L.new(M_("MULTIPLY", M_("MULTIPLY", glow, bright), level), b.inputs["Emission Strength"])
    cf, ca, cb, co = mix_rgb(N)
    ca.default_value = (.8, .88, 1.0, 1); cb.default_value = (1.0, .8, .56, 1)
    L.new(M_("MAXIMUM", M_("SUBTRACT", 1, office), M_("GREATER_THAN", noise4(floor, colo, 6.0), .45)), cf)
    wf, wa, wb, wo = mix_rgb(N)      # 밤: 차가운 흰빛 대신 따뜻한 빛
    L.new(co, wa); wb.default_value = (1.0, .74, .46, 1); L.new(M_("MULTIPLY", night, .7), wf)
    L.new(wo, b.inputs["Emission Color"])
    bf, ba, bb, bo = mix_rgb(N)
    ba.default_value = (.06, .055, .05, 1); bb.default_value = (.016, .02, .026, 1)
    L.new(M_("MAXIMUM", office, M_("MULTIPLY", window, .7)), bf); L.new(bo, b.inputs["Base Color"])
    L.new(M_("SUBTRACT", .78, M_("MULTIPLY", M_("MAXIMUM", office, window), .66)), b.inputs["Roughness"])
    b.inputs["Specular IOR Level"].default_value = .65
    no_emission_sampling(m)
    return m


CITY = []   # (x, y, h)


def build_city():
    fac = building_material()
    roof_mat = principled("roof plant", (.03, .032, .035), rough=.7)
    beacon = emissive("city beacon", (1.0, .12, .06), 60.0, attr="on")
    plot_mat = textured("sidewalk", (.05, .05, .052), (.085, .085, .09), rough=.75, scale=.4, bump=.05, variation=False, coords="World")
    curb = emissive("city street lights", (1.0, .74, .46), 3.0)
    unit = bpy.data.meshes.new("unit tower")
    unit.from_pydata([(-.5, -.5, 0), (.5, -.5, 0), (.5, .5, 0), (-.5, .5, 0), (-.5, -.5, 1), (.5, -.5, 1), (.5, .5, 1), (-.5, .5, 1)], [],
                     [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])
    unit.update(); unit.materials.append(fac)
    unit_roof = unit.copy(); unit_roof.materials.clear(); unit_roof.materials.append(roof_mat)
    unit_beacon = unit.copy(); unit_beacon.materials.clear(); unit_beacon.materials.append(beacon)
    r = random.Random(21)

    def tower(name, x, y, w, d, h, office, dist):
        ob = put(bpy.data.objects.new(name, unit))
        ob.location = (x, y, .22); ob.scale = (w, d, h)
        ob["office"] = 1.0 if office else 0.0
        # 해 질 녘엔 일부만, 준공 뒤 타워에서 바깥으로 불이 번진다
        l0 = 506 + dist * .05 + r.uniform(0, 8)
        prop(ob, "lit", [(0, .41 + r.uniform(0, .04)), (300, .43), (440, .5), (int(l0), .56), (int(l0 + 22), 1.0), (LAST, 1.0)])
        CITY.append((x, y, h))
        if h > 70:
            rb = put(bpy.data.objects.new(name + " roof", unit_roof))
            rb.location = (x + r.uniform(-w, w) * .12, y + r.uniform(-d, d) * .12, .22 + h); rb.scale = (w * .45, d * .4, r.uniform(3, 6))
        if h > 110:
            bc = put(bpy.data.objects.new(name + " beacon", unit_beacon))
            bc.location = (x, y, .22 + h + 6); bc.scale = (.9, .9, .9)
            prop(bc, "on", [(0, 1), (LAST, 1)], 1.0)
        return ob

    pitch, block = 64.0, 50.0
    cx0, cy0 = 60.0, 820.0
    for i in range(-14, 15):
        for j in range(0, 11):
            cx, cy = i * pitch + 30, RIVER_N + 60 + j * pitch
            if abs(cx - MUSEUM.x) < 90 and cy < RIVER_N + 150: continue      # 미술관 자리
            if abs(cx - BRIDGE_X) < 56 and cy < RIVER_N + 130: continue      # 다리 북쪽 끝
            core = math.exp(-((cx - cx0) ** 2 + (cy - cy0) ** 2) / (2 * 260 ** 2))
            dist = math.hypot(cx, cy)
            plot = Builder(plot_mat).box(cx - block / 2, cx + block / 2, cy - block / 2, cy + block / 2, 0, .22).build(f"plot {i},{j}")
            lights = Builder(curb)
            for sgn in (-1, 1):
                o = sgn * (block / 2 + .7)
                lights.box(cx - block / 2, cx + block / 2, cy + o - .07, cy + o + .07, .01, .04)
                lights.box(cx + o - .07, cx + o + .07, cy - block / 2, cy + block / 2, .01, .04)
            lights = lights.build(f"curb {i},{j}")
            l0 = 500 + dist * .045
            prop(lights, "lit", [(0, .25), (int(l0), .25), (int(l0 + 20), 1), (LAST, 1)])
            kind = r.random()
            lots = []
            if kind < .3:
                lots.append((cx, cy, 46, 46, r.uniform(8, 14), False))
                tw = r.uniform(20, 28)
                lots.append((cx + r.uniform(-5, 5), cy + r.uniform(-5, 5), tw, tw * r.uniform(.8, 1.25), (40 + 120 * core) * r.uniform(.6, 1.1), True))
            elif kind < .55:
                for sx in (-1, 1):
                    lots.append((cx + sx * 12.5, cy, r.uniform(18, 22), r.uniform(36, 46), (22 + 70 * core) * r.uniform(.5, 1.15), r.random() < .5))
            elif kind < .85:
                for sx in (-1, 1):
                    for sy in (-1, 1):
                        lots.append((cx + sx * 12.5, cy + sy * 12.5, r.uniform(16, 21), r.uniform(16, 21), (18 + 56 * core) * r.uniform(.5, 1.2), r.random() < .3))
            else:
                hh = (16 + 26 * core) * r.uniform(.7, 1.1)
                lots.append((cx, cy - 18, 48, 13, hh, False)); lots.append((cx, cy + 18, 48, 13, hh * r.uniform(.8, 1.2), False))
                lots.append((cx - 18, cy, 13, 22, hh * .9, False)); lots.append((cx + 18, cy, 13, 22, hh * 1.1, False))
            for k, (x, y, w, d, h, office) in enumerate(lots):
                tower(f"bldg {i},{j}.{k}", x, y, w, d, max(9.0, h), office, dist)
    # 남쪽 강변의 이웃 건물(낮게)
    for n, (x, y, w, d, h) in enumerate([
                                          (150, 10, 36, 30, 34), (220, -30, 44, 40, 58), (300, 16, 40, 36, 28), (380, -50, 50, 44, 72),
                                          (470, -10, 44, 44, 40)]):
        tower(f"south bldg {n}", x, y, w, d, h, n % 2 == 0, math.hypot(x, y))
    # 남쪽 시가지: 마지막 장면에서 타워가 도시 한가운데 서도록. 카메라가 지나는 길과 두 현장 둘레는 비운다.
    rs = random.Random(33)
    for i in range(-15, 16):
        for j in range(0, 14):
            cx, cy = i * 62 + 10, -150 - j * 62
            if cx < 130 and cy > -640: continue                             # 카메라 길(첫 장~도시)
            if abs(cx - 140) < 150 and abs(cy + 520) < 140: continue        # 연구 캠퍼스
            if abs(cx - 560) < 130 and abs(cy + 250) < 110: continue        # 주거 단지
            if rs.random() < .18: continue                                  # 공원·광장
            dist = math.hypot(cx, cy)
            for k in range(rs.choice((1, 2, 2, 4))):
                ox, oy = (rs.uniform(-12, 12), rs.uniform(-12, 12))
                w, d = rs.uniform(16, 30), rs.uniform(16, 30)
                h = rs.uniform(12, 40) * (1.4 if rs.random() < .12 else 1.0)
                tower(f"sbldg {i},{j}.{k}", cx + ox, cy + oy, w, d, h, rs.random() < .35, dist)


# ── 사장교(프로젝트 02) ───────────────────────────────────────────────
BRIDGE_X = 620.0


def build_bridge():
    b = Builder(BRIDGE_CON, CABLE, BRIDGE_LED, PYLON_WASH, CRANE_DARK)
    x = BRIDGE_X
    dz = 15.0
    y0, y1 = RIVER_S - 60, RIVER_N + 60
    b.box(x - 14, x + 14, y0, y1, dz - 1.6, dz, 0)
    b.box(x - 14, x - 13.4, y0, y1, dz, dz + 1.1, 4).box(x + 13.4, x + 14, y0, y1, dz, dz + 1.1, 4)
    for sx in (-1, 1):
        b.box(x + sx * 13.7 - .06, x + sx * 13.7 + .06, y0, y1, dz + 1.1, dz + 1.18, 2)
    pylons = [RIVER_S + 110, RIVER_N - 110]
    top = 112.0
    for py in pylons:
        # 역Y형 주탑
        for sx in (-1, 1):
            b.strut((x + sx * 15, py, -2), (x + sx * 3.2, py, 62), 3.4, 0)
        b.strut((x, py, 60), (x, py, top), 3.6, 0)
        b.box(x - 15, x + 15, py - 1.4, py + 1.4, dz - 2.4, dz - 1.6, 0)
        b.box(x - 1.9, x - 1.8, py - 1.9, py + 1.9, 62, top - 2, 3).box(x + 1.8, x + 1.9, py - 1.9, py + 1.9, 62, top - 2, 3)
        # 부채꼴 케이블
        for side in (-1, 1):
            for c in range(12):
                ya = py + side * (14 + c * 8.2)
                za = top - 4 - c * 2.6
                for sx in (-1, 1):
                    b.strut((x + sx * .9, py, za), (x + sx * 12.6, ya, dz + .2), .22, 1)
    for py in (y0 + 20, y1 - 20):
        b.box(x - 12, x + 12, py - 2, py + 2, -2, dz - 1.6, 0)
    ob = b.build("bridge")
    prop(ob, "lit", [(0, .0), (512, 0), (548, 1), (LAST, 1)])
    return ob


# ── 미술관(프로젝트 03): 강 건너 낮고 긴 파빌리온 ───────────────────────
MUSEUM = Vector((330.0, RIVER_N + 90, 0))


def build_museum():
    c = MUSEUM
    b = Builder(COPING, CURTAIN, textured("museum stone", (.55, .53, .5), (.72, .7, .66), rough=.7, scale=.25, bump=.05, coords="World"), LED)
    b.box(c.x - 70, c.x + 70, c.y - 34, c.y + 34, 0, .9, 0)
    b.box(c.x - 58, c.x + 58, c.y - 22, c.y - 21.8, .9, 9, 1).box(c.x - 58, c.x + 58, c.y + 21.8, c.y + 22, .9, 9, 1)
    b.box(c.x - 58, c.x - 57.8, c.y - 22, c.y + 22, .9, 9, 1).box(c.x + 57.8, c.x + 58, c.y - 22, c.y + 22, .9, 9, 1)
    b.box(c.x - 76, c.x + 76, c.y - 30, c.y + 30, 9, 11.2, 2)
    for xx in range(-54, 55, 12):
        b.box(c.x + xx - .7, c.x + xx + .7, c.y - 20, c.y - 19, .9, 9, 2)
    b.box(c.x - 74, c.x + 74, c.y - 29.6, c.y - 29.4, 8.95, 9.0, 3)
    ob = b.build("museum")
    prop(ob, "lit", [(0, 0), (520, 0), (548, 1), (LAST, 1)])
    inside = Builder(emissive("museum glow", (1.0, .78, .52), 3.0))
    inside.quad([(c.x - 57, c.y - 21, 8.8), (c.x + 57, c.y - 21, 8.8), (c.x + 57, c.y + 21, 8.8), (c.x - 57, c.y + 21, 8.8)])
    inside = inside.build("museum ceiling")
    prop(inside, "lit", [(0, .15), (510, .15), (540, 1), (LAST, 1)])


# ── 연구 캠퍼스(프로젝트 04)와 주거 단지(프로젝트 05) ──────────────────
LAB = Vector((140.0, -520.0, 0))
HOMES = Vector((560.0, -250.0, 0))


def build_lab_and_homes():
    """연구 캠퍼스: 톱날 지붕의 긴 연구동 세 개. 북쪽 채광창(수직면)이 밤에 줄지어 빛난다."""
    c = LAB
    panel = textured("lab panel", (.3, .31, .32), (.42, .43, .44), rough=.5, scale=.4, bump=.02, coords="World")
    solar = principled("solar panel", (.02, .03, .06), rough=.12, metal=.4, spec=.8)
    glow = emissive("lab glow", (1.0, .84, .62), 1.15)
    halls = [(-44, 0, 78, 34, 12), (40, 6, 64, 44, 10), (0, 62, 132, 28, 14)]
    b = Builder(panel, solar, glow, CURTAIN, LED)
    for (dx, dy, w, d, h) in halls:
        x0, x1, y0, y1 = c.x + dx - w / 2, c.x + dx + w / 2, c.y + dy - d / 2, c.y + dy + d / 2
        b.box(x0, x1, y0, y1, 4.6, h, 0)
        b.box(x0 + 3, x1 - 3, y0 + 3, y1 - 3, 0, 4.6, 0)
        b.box(x0, x1, y0 - .02, y0, 4.6, h, 0)
        # 1층 유리와 안쪽 빛
        for (ax, ay, bx, by) in ((x0, y0, x1, y0), (x1, y0, x1, y1), (x1, y1, x0, y1), (x0, y1, x0, y0)):
            b.quad([(ax, ay, .2), (bx, by, .2), (bx, by, 4.6), (ax, ay, 4.6)], 3)
        b.box(x0 + 1, x1 - 1, y0 + 1, y1 - 1, 4.3, 4.4, 2)
        # 톱날 지붕: 경사면(태양광)과 수직 채광창
        tw, th = 6.5, 3.2
        x = x0
        while x < x1 - .1:
            xa, xb = x, min(x1, x + tw)
            b.quad([(xa, y0, h), (xb, y0, h + th), (xb, y1, h + th), (xa, y1, h)], 1)
            b.quad([(xb, y0, h), (xb, y1, h), (xb, y1, h + th), (xb, y0, h + th)], 2)
            b.quad([(xa, y0, h), (xb, y0, h), (xb, y0, h + th)], 0)
            b.quad([(xa, y1, h), (xb, y1, h + th), (xb, y1, h)], 0)
            x = xb
        b.box(x0, x1, y0 - .1, y0, h * .5, h * .5 + .25, 4)
    ob = b.build("research campus")
    prop(ob, "lit", [(0, .15), (500, .15), (536, 1), (LAST, 1)])
    Builder(ASPHALT).box(c.x - 120, c.x + 120, c.y - 56, c.y - 44, -.1, .05).box(c.x + 100, c.x + 112, c.y - 56, c.y + 120, -.1, .05).build("lab road")
    rr = random.Random(12)
    for k in range(60):
        x = c.x + rr.uniform(-130, 130); y = c.y + rr.uniform(-95, 130)
        inside = any(abs(x - (c.x + dx)) < w / 2 + 6 and abs(y - (c.y + dy)) < d / 2 + 6 for dx, dy, w, d, _ in halls)
        if inside or (c.y - 60 < y < c.y - 40) or (c.x + 96 < x < c.x + 116): continue
        tree_at(f"lab tree {k}", x, y, rr.uniform(.9, 1.4), rr.uniform(0, 6.28))
    lamps = Builder(CRANE_DARK, STREET)
    for x in range(int(c.x - 110), int(c.x + 111), 22):
        lamps.box(x - .1, x + .1, c.y - 58.2, c.y - 58, 0, 6.5, 0).box(x - .3, x + .3, c.y - 58.6, c.y - 57.6, 6.3, 6.5, 0).box(x - .25, x + .25, c.y - 58.5, c.y - 57.7, 6.28, 6.3, 1)
    lamps = lamps.build("lab lamps")
    prop(lamps, "lit", [(0, 0), (500, 0), (530, 1), (LAST, 1)])
    unit = bpy.data.meshes["unit tower"]
    r = random.Random(5)
    for n in range(7):
        a = n / 7 * math.tau
        x, y = HOMES.x + 70 * math.cos(a), HOMES.y + 50 * math.sin(a)
        ob = put(bpy.data.objects.new(f"home tower {n}", unit))
        ob.location = (x, y, .22); ob.scale = (18, 18, r.uniform(48, 86))
        ob["office"] = 0.0
        prop(ob, "lit", [(0, .5), (520, .56), (548, 1), (LAST, 1)])


# ── 현장을 잇는 빛(마지막 장) ─────────────────────────────────────────
SITES = {}
DRAW_ARCS = False   # 마지막 장의 연결선은 웹 화면 위에 벡터로 그린다


def build_arcs():
    src = Vector((0, 0, PL + (NF + CROWN) * FH + 2))
    targets = {
        "bridge": Vector((BRIDGE_X, RIVER_N - 110, 114)),
        "museum": MUSEUM + Vector((0, 0, 12)),
        "lab": LAB + Vector((0, 20, 24)),
        "homes": HOMES + Vector((0, 0, 90)),
    }
    for n, (name, t) in enumerate(targets.items()):
        SITES[name] = t
        if not DRAW_ARCS: continue
        cu = bpy.data.curves.new(f"arc {name}", "CURVE"); cu.dimensions = "3D"
        cu.bevel_depth = .32; cu.bevel_resolution = 2
        cu.bevel_factor_mapping_end = "SPLINE"
        sp = cu.splines.new("POLY")
        pts = []
        mid = (src + t) / 2 + Vector((0, 0, 60 + (src - t).length * .28))
        for i in range(64):
            s = i / 63
            p = src * (1 - s) ** 2 + mid * 2 * s * (1 - s) + t * s * s
            pts.append(p)
        sp.points.add(len(pts) - 1)
        for i, p in enumerate(pts): sp.points[i].co = (p.x, p.y, p.z, 1)
        cu.materials.append(ARC)
        ob = put(bpy.data.objects.new(f"arc {name}", cu))
        f0 = 604 + n * 9
        bake(cu, "bevel_factor_end", [(f, ramp(f, f0, f0 + 40, ease_io)) for f in sorted({0, *span(f0, f0 + 40), LAST})])
        prop(ob, "fade", [(0, 0), (f0 - 1, 0), (f0, 1.0), (LAST, 1.0)])
        ring = Builder(RING)
        base = Vector((t.x, t.y, 1.2))
        for k in range(48):
            a0, a1 = math.tau * k / 48, math.tau * (k + 1) / 48
            for r0, r1 in ((13, 14.2), (22, 22.6)):
                ring.quad([(base.x + r0 * math.cos(a0), base.y + r0 * math.sin(a0), base.z), (base.x + r1 * math.cos(a0), base.y + r1 * math.sin(a0), base.z),
                           (base.x + r1 * math.cos(a1), base.y + r1 * math.sin(a1), base.z), (base.x + r0 * math.cos(a1), base.y + r0 * math.sin(a1), base.z)])
        ring = ring.build(f"ring {name}")
        prop(ring, "fade", [(0, 0), (f0 + 34, 0), (f0 + 48, 1.0), (LAST, 1.0)])


# ── 하늘과 해 ─────────────────────────────────────────────────────────
SUN_ROT = math.radians(292)
SKY_STRENGTH = [(0, 1.0), (300, 1.0), (500, 1.2), (LAST, 1.4)]
ELEV = [(0, -.5), (96, -.7), (192, -1.0), (300, -1.5), (408, -2.3), (500, -3.4), (590, -5.6), (LAST, -7.4)]


def sun_dir(elev):
    e = math.radians(elev)
    return Vector((math.cos(e) * math.sin(SUN_ROT), -math.cos(e) * math.cos(SUN_ROT), math.sin(e)))


def build_world():
    w = bpy.data.worlds.new("dusk"); S.world = w
    w.use_nodes = True
    N, L = w.node_tree.nodes, w.node_tree.links
    bg = N["Background"]
    sky = N.new("ShaderNodeTexSky"); sky.name = "Sky"
    sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_disc = False
    sky.altitude = 120
    sky.air_density, sky.aerosol_density = 1.0, 1.8
    sky.sun_rotation = SUN_ROT
    lp = N.new("ShaderNodeTexCoord")
    sp = N.new("ShaderNodeSeparateXYZ"); L.new(lp.outputs["Generated"], sp.inputs[0])
    zc = N.new("ShaderNodeMath"); zc.operation = "MAXIMUM"; zc.inputs[1].default_value = .03; L.new(sp.outputs["Z"], zc.inputs[0])
    cb = N.new("ShaderNodeCombineXYZ"); L.new(sp.outputs["X"], cb.inputs[0]); L.new(sp.outputs["Y"], cb.inputs[1]); L.new(zc.outputs[0], cb.inputs[2])
    nm = N.new("ShaderNodeVectorMath"); nm.operation = "NORMALIZE"; L.new(cb.outputs[0], nm.inputs[0])
    L.new(nm.outputs[0], sky.inputs["Vector"])
    tc = N.new("ShaderNodeTexCoord")
    stars = N.new("ShaderNodeTexVoronoi"); stars.inputs["Scale"].default_value = 420
    L.new(tc.outputs["Generated"], stars.inputs["Vector"])
    st = N.new("ShaderNodeMath"); st.operation = "LESS_THAN"; st.inputs[1].default_value = .035
    L.new(stars.outputs["Distance"], st.inputs[0])
    up = N.new("ShaderNodeSeparateXYZ"); L.new(tc.outputs["Generated"], up.inputs[0])
    hz = N.new("ShaderNodeMapRange"); hz.inputs["From Min"].default_value = .08; hz.inputs["From Max"].default_value = .45
    L.new(up.outputs["Z"], hz.inputs["Value"])
    sm = N.new("ShaderNodeMath"); sm.operation = "MULTIPLY"; L.new(st.outputs[0], sm.inputs[0]); L.new(hz.outputs["Result"], sm.inputs[1])
    starv = N.new("ShaderNodeValue"); starv.name = "Stars"
    sm2 = N.new("ShaderNodeMath"); sm2.operation = "MULTIPLY"; L.new(sm.outputs[0], sm2.inputs[0]); L.new(starv.outputs[0], sm2.inputs[1])
    af, aa, ab, ao = mix_rgb(N, "ADD"); af.default_value = 1
    L.new(sky.outputs["Color"], aa)
    sc = N.new("ShaderNodeCombineXYZ")
    for k in range(3): L.new(sm2.outputs[0], sc.inputs[k])
    L.new(sc.outputs[0], ab)
    L.new(ao, bg.inputs["Color"])
    frames = sorted({*range(0, LAST + 1, 4), LAST})
    starsv = [(0, 0), (420, 0), (590, .5), (LAST, .85)]
    bake(w.node_tree, 'nodes["Sky"].sun_elevation', [(f, math.radians(piece(ELEV, f))) for f in frames])
    bake(w.node_tree, 'nodes["Background"].inputs[1].default_value', [(f, piece(SKY_STRENGTH, f)) for f in frames])
    bake(w.node_tree, 'nodes["Stars"].outputs[0].default_value', [(f, piece(starsv, f)) for f in frames])
    expo = [(0, .55), (96, .55), (192, .6), (300, .68), (408, .8), (500, .98), (590, 1.25), (LAST, 1.35)]
    bake(S, "view_settings.exposure", [(f, piece(expo, f)) for f in frames])
    # 해: 하늘과 같은 방향의 따뜻한 직사광. 지평선 아래로 내려가면 꺼진다.
    ld = bpy.data.lights.new("sun", "SUN"); ld.angle = math.radians(.6); ld.color = (1.0, .62, .34)
    sun = put(bpy.data.objects.new("sun", ld))
    sun.rotation_mode = "QUATERNION"
    q = sun_dir(3.0).to_track_quat("Z", "Y")
    sun.rotation_quaternion = q
    for i in range(4):
        bake(sun, "rotation_quaternion", [(f, sun_dir(max(.2, piece(ELEV, f))).to_track_quat("Z", "Y")[i]) for f in frames], index=i)
    bake(ld, "energy", [(f, 3.4 * clamp01(piece(ELEV, f) / 1.4) ** .7) for f in frames])


# ── 카메라 ───────────────────────────────────────────────────────────
# 단계마다: 눈, 시선, 렌즈, 가로 이동(글 단이 왼쪽에 오도록 대상은 오른쪽에), 조리개
SHOTS = [
    dict(eye=(-50, -126, 22), at=(6, 14, 8), lens=28, shift=-.2, fstop=16),         # 0 첫 선
    dict(eye=(-66, -104, 52), at=(4, 4, 0), lens=30, shift=-.2, fstop=16),          # 1 측량
    dict(eye=(-100, -124, 26), at=(4, 4, 36), lens=30, shift=-.2, fstop=16),        # 2 기초
    dict(eye=(-136, -158, 80), at=(2, 2, 88), lens=30, shift=-.2, fstop=16),        # 3 골조
    dict(eye=(-160, -120, 246), at=(0, 0, 200), lens=32, shift=-.2, fstop=16),      # 4 상량
    dict(eye=(-84, -236, 14), at=(0, 0, 112), lens=24, shift=-.14, fstop=16),       # 5 준공
    dict(eye=(-250, -310, 58), at=(0, 30, 100), lens=28, shift=-.2, fstop=16),      # 6 점등
    dict(eye=(-760, 150, 40), at=(400, 150, 70), lens=34, shift=-.16, fstop=22),    # 7 도시
]
VIA = {
    0: [],
    2: [(-130, -150, 50)],
    3: [(-130, -110, 180)],
    4: [(-150, -200, 150), (-120, -250, 50)],
    5: [(-160, -300, 40)],
    6: [(-620, -140, 90)],
}
for k, v in (json.loads(A.shots) if A.shots else {}).items():
    SHOTS[int(k)].update(v)


def camera_curve():
    """카메라는 모든 장의 구도를 멈추지 않고 지나간다. 장과 장 사이의 경유점(VIA)은 그 구간에 고르게 놓는다."""
    eyes = []
    for k in range(len(ANCHORS)):
        eyes.append((ANCHORS[k], Vector(SHOTS[k]["eye"])))
        if k < len(ANCHORS) - 1:
            vias = VIA.get(k, [])
            for j, v in enumerate(vias):
                eyes.append((ANCHORS[k] + (ANCHORS[k + 1] - ANCHORS[k]) * (j + 1) / (len(vias) + 1), Vector(v)))
    ats = [(ANCHORS[k], Vector(SHOTS[k]["at"])) for k in range(len(ANCHORS))]
    lens = [(ANCHORS[k], float(SHOTS[k]["lens"])) for k in range(len(ANCHORS))]
    shift = [(ANCHORS[k], float(SHOTS[k]["shift"])) for k in range(len(ANCHORS))]
    fst = [(ANCHORS[k], math.log(SHOTS[k]["fstop"])) for k in range(len(ANCHORS))]

    def at(f):
        f = max(0, min(LAST, f))
        return spline(eyes, f), spline(ats, f), spline(lens, f), spline(shift, f), math.exp(spline(fst, f))
    return at


CAM_AT = camera_curve()


def build_camera():
    cd = bpy.data.cameras.new("camera"); cd.sensor_width = 36
    cam = put(bpy.data.objects.new("camera", cd)); S.camera = cam
    cd.clip_start, cd.clip_end = .3, 12000
    cd.dof.use_dof = True
    frames = ALL
    locs, rots, lens, shift, focus, fstop = [], [], [], [], [], []
    prev = None
    for f in frames:
        eye, look, ln, sh, fs = CAM_AT(f)
        q = (look - eye).to_track_quat("-Z", "Y")
        e = q.to_euler("XYZ", prev) if prev else q.to_euler("XYZ")
        prev = e
        locs.append(eye); rots.append(e); lens.append(ln); shift.append(sh)
        focus.append((look - eye).length); fstop.append(fs)
    for i in range(3):
        bake(cam, "location", [(f, locs[n][i]) for n, f in enumerate(frames)], index=i)
        bake(cam, "rotation_euler", [(f, rots[n][i]) for n, f in enumerate(frames)], index=i)
    bake(cd, "lens", list(zip(frames, lens)))
    bake(cd, "shift_x", list(zip(frames, shift)))
    bake(cd, "dof.focus_distance", list(zip(frames, focus)))
    bake(cd, "dof.aperture_fstop", list(zip(frames, fstop)))
    return cam


# ── 굽기: 자라는 나무 ─────────────────────────────────────────────────
def bake_grow():
    for ob, f0, s in GROW:
        f1 = f0 + 22
        fr = sorted({0, *span(f0, f1), LAST})
        back = lambda t: 1 + 2.0 * (t - 1) ** 3 + 1.0 * (t - 1) ** 2 if t > 0 else 0.0
        for i in range(3):
            bake(ob, "scale", [(f, max(.001, s * back(clamp01((f - f0) / (f1 - f0))))) for f in fr], index=i)
        hide_until(ob, f0)


# ── 대기와 마감 ───────────────────────────────────────────────────────
HAZE = [(0, (0, 0, 0)), (500, (0, 0, 0)), (590, (.006, .01, .02)), (LAST, (.008, .012, .024))]


def add_haze():
    """먼 곳일수록 그 방향 지평선의 하늘빛에 묻힌다(대기 원근). 모든 재질의 출력 앞에 같은 그룹을 끼운다.
    안개 색은 월드와 같은 설정의 하늘 텍스처를 시선 방향(지평선 쪽으로 눌러)으로 읽어 쓴다."""
    g = bpy.data.node_groups.new("haze", "ShaderNodeTree")
    g.interface.new_socket("Shader", in_out="INPUT", socket_type="NodeSocketShader")
    g.interface.new_socket("Shader", in_out="OUTPUT", socket_type="NodeSocketShader")
    N, L = g.nodes, g.links
    gi, go = N.new("NodeGroupInput"), N.new("NodeGroupOutput")
    cam = N.new("ShaderNodeCameraData")
    k = N.new("ShaderNodeMath"); k.operation = "MULTIPLY"; k.inputs[1].default_value = -1 / 2600
    L.new(cam.outputs["View Distance"], k.inputs[0])
    e = N.new("ShaderNodeMath"); e.operation = "EXPONENT"; L.new(k.outputs[0], e.inputs[0])
    inv = N.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1.0; L.new(e.outputs[0], inv.inputs[1])
    fac = N.new("ShaderNodeMath"); fac.operation = "MULTIPLY"; fac.inputs[1].default_value = .94; L.new(inv.outputs[0], fac.inputs[0])
    geo = N.new("ShaderNodeNewGeometry")
    neg = N.new("ShaderNodeVectorMath"); neg.operation = "SCALE"; neg.inputs["Scale"].default_value = -1.0
    L.new(geo.outputs["Incoming"], neg.inputs[0])
    sp = N.new("ShaderNodeSeparateXYZ"); L.new(neg.outputs[0], sp.inputs[0])
    zc = N.new("ShaderNodeMath"); zc.operation = "MAXIMUM"; zc.inputs[1].default_value = .03; L.new(sp.outputs["Z"], zc.inputs[0])
    cb = N.new("ShaderNodeCombineXYZ"); L.new(sp.outputs["X"], cb.inputs[0]); L.new(sp.outputs["Y"], cb.inputs[1]); L.new(zc.outputs[0], cb.inputs[2])
    nm = N.new("ShaderNodeVectorMath"); nm.operation = "NORMALIZE"; L.new(cb.outputs[0], nm.inputs[0])
    sky = N.new("ShaderNodeTexSky"); sky.name = "HazeSky"
    ws = S.world.node_tree.nodes["Sky"]
    sky.sky_type = ws.sky_type; sky.sun_disc = False; sky.altitude = ws.altitude
    sky.air_density, sky.aerosol_density = ws.air_density, ws.aerosol_density
    sky.sun_rotation = ws.sun_rotation
    L.new(nm.outputs[0], sky.inputs["Vector"])
    stren = N.new("ShaderNodeValue"); stren.name = "HazeStrength"
    mulc = N.new("ShaderNodeVectorMath"); mulc.operation = "SCALE"
    L.new(sky.outputs["Color"], mulc.inputs[0]); L.new(stren.outputs[0], mulc.inputs["Scale"])
    tint = N.new("ShaderNodeRGB"); tint.name = "Haze"
    addc = N.new("ShaderNodeVectorMath"); addc.operation = "ADD"
    L.new(mulc.outputs[0], addc.inputs[0]); L.new(tint.outputs[0], addc.inputs[1])
    em = N.new("ShaderNodeEmission"); L.new(addc.outputs[0], em.inputs["Color"])
    mx = N.new("ShaderNodeMixShader")
    L.new(fac.outputs[0], mx.inputs[0]); L.new(gi.outputs[0], mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], go.inputs[0])
    frames = sorted({*range(0, LAST + 1, 4), LAST})
    bake(g, 'nodes["HazeSky"].sun_elevation', [(f, math.radians(piece(ELEV, f))) for f in frames])
    night = [(0, .9), (300, .9), (408, .82), (500, .7), (590, .52), (LAST, .46)]
    bake(g, 'nodes["HazeStrength"].outputs[0].default_value', [(f, piece(night, f) * piece(SKY_STRENGTH, f)) for f in frames])

    def at(f):
        for (f0, c0), (f1, c1) in zip(HAZE, HAZE[1:]):
            if f0 <= f <= f1:
                t = ease_io((f - f0) / (f1 - f0)); return [lerp(a, b, t) for a, b in zip(c0, c1)] + [1.0]
        return list(HAZE[-1][1]) + [1.0]
    for i in range(4):
        bake(g, 'nodes["Haze"].outputs[0].default_value', [(f, at(f)[i]) for f in frames], index=i)
    for m in list(bpy.data.materials):
        if not m.node_tree: continue
        out = next((n for n in m.node_tree.nodes if n.type == "OUTPUT_MATERIAL"), None)
        if out is None or not out.inputs["Surface"].links: continue
        if m.name != "curtain glass" and any(n.type == "BSDF_TRANSPARENT" for n in m.node_tree.nodes):
            continue   # 사라지는 선·호: 안개를 섞으면 투명한 자리에 유령 윤곽이 남는다
        src = out.inputs["Surface"].links[0].from_socket
        node = m.node_tree.nodes.new("ShaderNodeGroup"); node.node_tree = g
        m.node_tree.links.new(src, node.inputs[0]); m.node_tree.links.new(node.outputs[0], out.inputs["Surface"])
        if m.name != "tower ceiling":
            no_emission_sampling(m)


def add_bloom():
    ng = bpy.data.node_groups.new("finish", "CompositorNodeTree")
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    N, L = ng.nodes, ng.links
    rl = N.new("CompositorNodeRLayers")
    gl = N.new("CompositorNodeGlare")
    for key, val in (("Type", "Bloom"), ("Quality", "High")):
        try: gl.inputs[key].default_value = val
        except Exception as e: print("GLARE", key, e)
    for key, val in (("Threshold", 1.5), ("Smoothness", .3), ("Strength", .4), ("Size", .55), ("Saturation", 1.0)):
        try: gl.inputs[key].default_value = val
        except Exception as e: print("GLARE", key, e)
    out = N.new("NodeGroupOutput")
    L.new(rl.outputs["Image"], gl.inputs["Image"]); L.new(gl.outputs["Image"], out.inputs[0])
    S.compositing_node_group = ng
    S.render.use_compositing = True


# ── 라벨 좌표 ─────────────────────────────────────────────────────────
def export_track():
    cam = S.camera

    def near_corner(k):
        pts, _ = outline(min(NF - 1, max(0, int(k))))
        return min(pts, key=lambda p: (p - Vector((INSTR.x, INSTR.y, 0))).length)

    anchors = {
        "instrument": lambda f: INSTR + Vector((0, 0, 1.9)),
        "lineA": lambda f: Vector((FIRST_LINE[0][0], FIRST_LINE[0][1], .06)),
        "lineB": lambda f: Vector((FIRST_LINE[1][0], FIRST_LINE[1][1], .06)),
        "measureA": lambda f: Vector((0, 0, 190)),
        "grid": lambda f: Vector((-42.4, -42.4, .1)),
        "footprint": lambda f: Vector((HALF * .72, -HALF * .72, .1)),
        "raft": lambda f: Vector((-18, -14, PL)),
        "crane": lambda f: Vector((3.2, 1, crane_seat(f) + MAST * .62)),
        "slab": lambda f: (lambda p: Vector((p.x, p.y, slab_top(f))))(near_corner(slabs(f))),
        "skin": lambda f: (lambda p: Vector((p.x, p.y, PL + facade(f) * FH)))(near_corner(facade(f))),
        "crown": lambda f: Vector((0, 0, PL + (NF + CROWN) * FH)),
        "top": lambda f: Vector((0, 0, PL + NF * FH * .82)),
        "tower": lambda f: Vector((0, 0, max(PL + 4, slab_top(f) * .55))),
        **{k: (lambda v: (lambda f: v))(v) for k, v in SITES.items()},
    }
    out = {"fps": FPS, "frames": LAST + 1, "width": W, "height": H, "anchors": ANCHORS,
           "labels": {k: [] for k in anchors}, "floors": [], "skin": [], "core": []}
    for f in range(LAST + 1):
        S.frame_set(f)
        for k, fn in anchors.items():
            v = fn(f)
            p = world_to_camera_view(S, cam, v)
            vis = p.z > 0 and -.05 < p.x < 1.05 and -.05 < p.y < 1.05
            out["labels"][k].append([round(p.x * W), round((1 - p.y) * H), 1 if vis else 0])
        out["floors"].append(round(slabs(f), 2))
        out["skin"].append(round(facade(f), 2))
        out["core"].append(round(core_floors(f), 2))
    TRACK.parent.mkdir(parents=True, exist_ok=True)
    TRACK.write_text(json.dumps(out, separators=(",", ":")))
    TWIN.parent.mkdir(parents=True, exist_ok=True)
    TWIN.write_text(json.dumps({"PL": PL, "FH": FH, "NF": NF, "HALF": HALF, "SQN": SQN, "TWIST": TWIST, "TAPER": TAPER, "M": M,
                                "CORE": CORE, "COLR": COLR, "NCOL": NCOL, "CROWN": CROWN}, indent=1))
    print("TRACK", TRACK)


def layout_report():
    cam = S.camera
    tower = [Vector((x, y, z)) for x in (-HALF, HALF) for y in (-HALF, HALF) for z in (0, PL + (NF + CROWN) * FH)]
    site = [Vector((x, y, 0)) for x in (SITE[0], SITE[2]) for y in (SITE[1], SITE[3])]
    for k, f in enumerate(ANCHORS):
        S.frame_set(f)
        out = []
        for name, pts in (("tower", tower), ("site", site), ("instr", [INSTR])):
            ps = [world_to_camera_view(S, cam, v) for v in pts]
            if any(q.z <= 0 for q in ps): out.append(f"{name}: behind"); continue
            xs = [q.x * W for q in ps]; ys = [(1 - q.y) * H for q in ps]
            out.append(f"{name}: x {min(xs):.0f}~{max(xs):.0f} y {min(ys):.0f}~{max(ys):.0f}")
        print("LAYOUT", k, f, " | ".join(out))


# ── 프로젝트 사진용 카메라(영상과 같은 세계, 다른 시점) ──────────────────
# 건축 사진처럼: 카메라는 수평(세로선이 기울지 않게), 위아래는 렌즈 시프트로 맞춘다. 해가 진 직후의 청색 시간.
SHOTS_STILL = {
    "tower": dict(frame=566, eye=(430, 250, 4), at=(0, 0, 4), lens=30, shift=.05, shift_y=.1, fstop=11),
    "bridge": dict(frame=566, eye=(790, 92, 2), at=(560, 330, 2), lens=24, shift=.04, shift_y=.1, fstop=11),
    "museum": dict(frame=566, eye=(MUSEUM.x - 120, RIVER_N - 36, 1.8), at=(MUSEUM.x + 20, MUSEUM.y - 16, 1.8), lens=30, shift=-.02, shift_y=.07, fstop=11),
    "lab": dict(frame=540, eye=(LAB.x + 120, LAB.y - 100, 16), at=(LAB.x - 10, LAB.y + 30, 16), lens=32, shift=0, shift_y=-.02, fstop=11),
}


def set_still_camera(name):
    s = SHOTS_STILL[name]
    cam = S.camera
    if cam.animation_data: cam.animation_data_clear()
    if cam.data.animation_data: cam.data.animation_data_clear()
    eye, look = Vector(s["eye"]), Vector(s["at"])
    cam.location = eye
    cam.rotation_mode = "QUATERNION"; cam.rotation_quaternion = (look - eye).to_track_quat("-Z", "Y")
    cam.data.lens = s["lens"]; cam.data.shift_x = s["shift"]; cam.data.shift_y = s.get("shift_y", 0.0)
    cam.data.dof.focus_distance = (look - eye).length; cam.data.dof.aperture_fstop = s["fstop"]
    return s["frame"]


# ── 실행 ─────────────────────────────────────────────────────────────
t0 = time.time()
build_world()
build_ground()
build_survey()
build_instrument()
build_foundation()
build_tower()
build_crane()
build_jumpform()
build_plaza()
build_city()
build_bridge()
build_museum()
build_lab_and_homes()
build_arcs()
build_camera()
bake_grow()
add_haze()
add_bloom()
print(f"BUILD {time.time() - t0:.1f}s objects={len(bpy.data.objects)}")

if A.mode in ("track", "final"):
    export_track()
if A.mode == "layout":
    layout_report()
if A.save:
    WORK.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK / "film.blend"))

if A.mode == "still":
    target = Path(A.out) if A.out else WORK / "stills"
    target.mkdir(parents=True, exist_ok=True)
    for f in [int(x) for x in (A.frames or ",".join(map(str, ANCHORS))).split(",") if x]:
        S.frame_set(f)
        S.render.filepath = str(target / f"f{f:04d}.png")
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"STILL {f} {time.time() - t:.1f}s", flush=True)
elif A.mode == "shot":
    target = Path(A.out) if A.out else WORK / "shots"
    target.mkdir(parents=True, exist_ok=True)
    for name in (A.shot.split(",") if A.shot else SHOTS_STILL):
        f = set_still_camera(name)
        S.frame_set(f)
        S.render.filepath = str(target / f"{name}.png")
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"SHOT {name} {time.time() - t:.1f}s", flush=True)
elif A.mode == "final":
    frames_dir = WORK / "frames"; frames_dir.mkdir(parents=True, exist_ok=True)
    S.render.filepath = str(frames_dir / "f")
    S.render.use_overwrite = False
    S.render.use_placeholder = True
    if A.frames:
        a, b = [int(x) for x in A.frames.split("-")]
        S.frame_start, S.frame_end = a, b
    bpy.ops.render.render(animation=True)
