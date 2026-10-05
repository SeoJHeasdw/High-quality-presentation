#!/usr/bin/env python3
"""Keynote 15 · 스크롤 페이지 영상.

해 질 녘 빈 대지의 평면선 위로 집의 부품이 위·좌우에서 날아와 조립되고,
카메라가 물러나며 도시가 세워지고 불이 켜진 뒤, 교차로로 내려갔다가 다시 집으로 돌아온다.
페이지는 이 영상을 스크롤 위치로 스크럽한다. 멈추는 지점(ANCHORS)에서는
카메라와 부품이 모두 정지해 있어 모션 블러 없이 선명하다. 교차로(7단계)만은
차와 로봇이 계속 움직이므로, 같은 카메라로 렌더한 반복 영상(--mode loop)이 정지 화면 대신 돈다.

  blender -b --python deck/tools/render-house-scroll.py -- --mode still --frames 0,84,168 --scale 50
  blender -b --python deck/tools/render-house-scroll.py -- --mode final --frames 481-670   # 7단계부터 다시
  blender -b --python deck/tools/render-house-scroll.py -- --mode loop
  blender -b --python deck/tools/render-house-scroll.py -- --mode track   # 라벨 좌표만 다시 계산
  blender -b --python deck/tools/render-house-scroll.py -- --mode still --frames 670 --time sunrise --scale 100 --samples 160 --out render/house-dawn
      # 42~46번: 마지막 정지 지점(집)을 같은 카메라로, 하늘과 불빛만 새벽으로 바꿔 한 장 렌더

결과 프레임은 render/house-scroll/frames/, 반복 영상 프레임은 render/house-scroll/loop/,
라벨 좌표는 src/keynote/next-market/track.json. 인코딩은 tools/encode-house-scroll.sh.
"""
import bpy, math, json, sys, argparse, random, time, zlib
from bisect import bisect
from pathlib import Path
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/house-scroll"
TRACK = ROOT / "src/keynote/next-market/track.json"
WORK = ROOT / "render/house-scroll"
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mode", choices=["still", "final", "loop", "track", "verify", "layout"], default="still")
ap.add_argument("--frames", default="")
ap.add_argument("--samples", type=int, default=0)
ap.add_argument("--scale", type=int, default=0, help="resolution percentage")
ap.add_argument("--out", default="")
ap.add_argument("--save", action="store_true")
ap.add_argument("--shots", default="", help='구도 실험: {"5": {"eye": [x, y, z]}}')
ap.add_argument("--time", choices=["night", "blue", "sunrise"], default="night", help="마지막 정지 지점의 시간대(35~38번 배경)")
A = ap.parse_args(ARGS)

FPS = 30
# 발표자가 멈추는 지점. 페이지의 단계(0~8)와 1:1로 대응한다.
# 7단계(교차로)는 2026-10-05에 넣었다. 0~480 프레임은 그 전 렌더와 같아야 하므로
# 480 이후를 바꾸는 값은 모두 split()으로 480에서 끊는다. 예전 마지막 프레임은 570이었다.
ANCHORS = [0, 84, 168, 252, 342, 420, 480, 570, 670]
LAST = ANCHORS[-1]
KEEP, OLD_LAST = ANCHORS[6], 570
W, H = 1920, 1080


# ── 수학 ─────────────────────────────────────────────────────────────
def clamp01(x): return max(0.0, min(1.0, x))
def lerp(a, b, t): return a + (b - a) * t
def ease_io(t):
    t = clamp01(t)
    return 4 * t * t * t if t < .5 else 1 - (-2 * t + 2) ** 3 / 2
def ease_out(t, p=3.0): return 1 - (1 - clamp01(t)) ** p
def ramp(f, f0, f1, fn=ease_io): return fn((f - f0) / (f1 - f0)) if f1 > f0 else float(f >= f1)
def catmull(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)


# ── 장면 기본 ─────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene
S.frame_start, S.frame_end = 0, LAST
S.render.fps = FPS
S.render.resolution_x, S.render.resolution_y = W, H
S.render.resolution_percentage = A.scale or (100 if A.mode == "final" else 50)
S.render.engine = "CYCLES"
S.cycles.device = "GPU"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "METAL"
prefs.get_devices()
for d in prefs.devices: d.use = d.type == "METAL"
S.cycles.samples = A.samples or (160 if A.mode == "final" else 64)
S.cycles.use_adaptive_sampling = True
S.cycles.adaptive_threshold = 0.015
S.cycles.use_denoising = True
S.cycles.denoiser = "OPENIMAGEDENOISE"
S.cycles.denoising_use_gpu = True
S.cycles.max_bounces, S.cycles.diffuse_bounces, S.cycles.glossy_bounces = 10, 3, 4
S.cycles.transmission_bounces, S.cycles.transparent_max_bounces = 8, 12
S.cycles.sample_clamp_indirect = 6.0
S.cycles.caustics_reflective = S.cycles.caustics_refractive = False
S.cycles.use_light_tree = True
S.render.use_persistent_data = True
S.render.use_motion_blur = True
S.render.motion_blur_shutter = 0.45
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
    """samples: [(frame, value)]. 카메라·부품·조명 모두 이 한 가지 방법으로 움직인다."""
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


def bake_vec(idb, path, frames, fn, size=3):
    vals = [fn(f) for f in frames]
    for i in range(size):
        bake(idb, path, [(f, v[i]) for f, v in zip(frames, vals)], index=i)


def prop(ob, name, samples, default=0.0):
    ob[name] = float(default)
    bake(ob, f'["{name}"]', samples)


def span(f0, f1): return list(range(int(f0), int(f1) + 1))


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
    # Mix 노드는 같은 이름의 소켓이 타입별로 여러 개라 이름으로 찾으면 꺼진 Float 소켓이 잡힌다.
    for s in sockets:
        if s.identifier == ident: return s
    raise KeyError(ident)


def mix_rgb(N, blend="MIX"):
    n = N.new("ShaderNodeMix"); n.data_type = "RGBA"; n.blend_type = blend
    return sock(n.inputs, "Factor_Float"), sock(n.inputs, "A_Color"), sock(n.inputs, "B_Color"), sock(n.outputs, "Result_Color")


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


def lit_emission(m, color, strength, attr="lit"):
    """Principled 표면에 오브젝트 속성(lit)으로 켜지는 발광을 붙인다."""
    N, L = tree_of(m)
    b = N["Principled BSDF"]
    at = N.new("ShaderNodeAttribute"); at.attribute_type = "OBJECT"; at.attribute_name = attr
    mul = N.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = strength
    L.new(at.outputs["Fac"], mul.inputs[0])
    b.inputs["Emission Color"].default_value = (*color, 1)
    L.new(mul.outputs[0], b.inputs["Emission Strength"])
    return m


def textured(name, lo, hi, rough=.8, scale=1.4, bump=.12, stretch=(1, 1, 1), variation=True, rough_var=.1):
    """노이즈 두 톤과 미세 요철. 콘크리트·석재·목재·잔디에 공통으로 쓴다."""
    m = bpy.data.materials.new(name)
    N, L = tree_of(m)
    b = N["Principled BSDF"]
    tc = N.new("ShaderNodeTexCoord")
    mp = N.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = stretch
    L.new(tc.outputs["Object"], mp.inputs["Vector"])
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = 9; nz.inputs["Roughness"].default_value = .6
    L.new(mp.outputs["Vector"], nz.inputs["Vector"])
    cr = N.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].position, cr.color_ramp.elements[0].color = .32, (*lo, 1)
    cr.color_ramp.elements[1].position, cr.color_ramp.elements[1].color = .72, (*hi, 1)
    L.new(nz.outputs["Fac"], cr.inputs["Fac"])
    col = cr.outputs["Color"]
    if variation:
        # 판재·패널마다 조금씩 다른 색
        gi = N.new("ShaderNodeNewGeometry")
        fac, ma, mb, mo = mix_rgb(N, "MULTIPLY")
        v = N.new("ShaderNodeMapRange"); v.inputs["To Min"].default_value = .86; v.inputs["To Max"].default_value = 1.1
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


def glass(name, tint=(.93, .97, .98), rough=.01):
    """얇은 판유리: 반사는 Fresnel로, 그림자 광선은 통과시켜 실내 빛이 밖으로 새어 나온다."""
    m = bpy.data.materials.new(name)
    N, L = tree_of(m)
    b = N["Principled BSDF"]; out = N["Material Output"]
    b.inputs["Base Color"].default_value = (*tint, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Transmission Weight"].default_value = 1.0
    b.inputs["IOR"].default_value = 1.52
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


def water(name):
    m = bpy.data.materials.new(name)
    N, L = tree_of(m)
    b = N["Principled BSDF"]
    b.inputs["Base Color"].default_value = (.82, .96, .96, 1)
    b.inputs["Roughness"].default_value = .02
    b.inputs["Transmission Weight"].default_value = 1.0
    b.inputs["IOR"].default_value = 1.333
    tc = N.new("ShaderNodeTexCoord")
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 2.2; nz.inputs["Detail"].default_value = 5
    L.new(tc.outputs["Object"], nz.inputs["Vector"])
    bp = N.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = .14; bp.inputs["Distance"].default_value = .05
    L.new(nz.outputs["Fac"], bp.inputs["Height"]); L.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def pool_tile():
    """15cm 모자이크 타일. 켜지면 청록빛이 조금 돈다."""
    m = bpy.data.materials.new("pool tile")
    N, L = tree_of(m)
    b = N["Principled BSDF"]
    tc = N.new("ShaderNodeTexCoord")
    br = N.new("ShaderNodeTexBrick"); br.offset = 0.0
    br.inputs["Scale"].default_value = 6.6; br.inputs["Mortar Size"].default_value = .012
    br.inputs["Brick Width"].default_value = 1.0; br.inputs["Row Height"].default_value = 1.0
    br.inputs["Color1"].default_value = (.5, .74, .78, 1); br.inputs["Color2"].default_value = (.44, .68, .73, 1)
    br.inputs["Mortar"].default_value = (.22, .34, .37, 1)
    L.new(tc.outputs["Object"], br.inputs["Vector"]); L.new(br.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = .25
    return lit_emission(m, (.3, .8, .9), .35)


def blueprint_mat():
    """평면선. 오브젝트 속성 fade로 투명해진다(발광만 0이 되면 검은 선이 남는다)."""
    m = emissive("blueprint", (.52, .84, 1.0), 3.2, attr="fade")
    N, L = tree_of(m)
    out = next(n for n in N if n.type == "OUTPUT_MATERIAL")
    em = next(n for n in N if n.type == "EMISSION")
    at = next(n for n in N if n.type == "ATTRIBUTE")
    tr = N.new("ShaderNodeBsdfTransparent"); mx = N.new("ShaderNodeMixShader")
    L.new(at.outputs["Fac"], mx.inputs[0]); L.new(tr.outputs[0], mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], out.inputs["Surface"])
    return m


CONCRETE = textured("board concrete", (.36, .355, .345), (.56, .55, .53), rough=.86, scale=1.2, bump=.18)
CONCRETE_DARK = textured("plinth concrete", (.2, .2, .2), (.33, .325, .315), rough=.8, scale=1.6, bump=.15)
SLAB = textured("slab concrete", (.5, .49, .47), (.66, .65, .62), rough=.7, scale=2.4, bump=.06)
PAVING = textured("terrace stone", (.34, .33, .31), (.5, .48, .45), rough=.6, scale=3.2, bump=.08)
WOOD = textured("cedar cladding", (.18, .095, .045), (.4, .23, .12), rough=.62, scale=3.0, bump=.1, stretch=(1, 1, .08))
OAK = textured("oak floor", (.33, .21, .12), (.52, .36, .22), rough=.45, scale=2.0, bump=.02, stretch=(1, .1, 1))
PLASTER = principled("plaster", (.78, .76, .72), rough=.92)
FABRIC = textured("linen", (.42, .4, .37), (.56, .54, .5), rough=.95, scale=18, bump=.05, variation=False)
DARKWOOD = principled("walnut", (.1, .06, .035), rough=.45)
STONE_TOP = principled("kitchen stone", (.72, .7, .67), rough=.25)
METAL = principled("bronze frame", (.035, .033, .03), rough=.32, metal=1.0)
GLASS = glass("window glass")
WATER = water("reflecting pool")
LAWN = textured("lawn", (.02, .042, .014), (.05, .085, .03), rough=.95, scale=.35, bump=.2, variation=False, rough_var=.03)
LEAF = textured("leaves", (.01, .026, .012), (.035, .066, .028), rough=.8, scale=14, bump=.7, variation=True)
BARK = principled("bark", (.05, .04, .032), rough=.9)
WARM = (1.0, .66, .36)
PANEL = lit_emission(principled("ceiling diffuser", (.85, .84, .82), rough=.6), WARM, 9.0)
PENDANT = emissive("pendant glow", (1.0, .6, .3), 42.0)
DOWNLIGHT = emissive("downlight", (1.0, .72, .45), 60.0)
LEDSTRIP = emissive("soffit led", (1.0, .7, .42), 26.0)
SLOTGLOW = emissive("slot glow", (1.0, .62, .32), 7.0)
POOLGLOW = emissive("pool light", (.35, .9, 1.0), 5.5)
BOLLARD = emissive("bollard", (1.0, .74, .48), 30.0)
BLUEPRINT = blueprint_mat()


# ── 형상 ─────────────────────────────────────────────────────────────
class Builder:
    """상자를 한 메시에 모은다. 부품 하나가 메시 몇 개로 끝나도록."""
    def __init__(self, *mats):
        self.v, self.f, self.mi, self.mats = [], [], [], list(mats)

    def box(self, x0, x1, y0, y1, z0, z1, mi=0):
        o = len(self.v)
        self.v += [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        self.f += [tuple(o + i for i in q) for q in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7))]
        self.mi += [mi] * 6
        return self

    def quad(self, pts, mi=0):
        o = len(self.v); self.v += pts; self.f.append(tuple(o + i for i in range(len(pts)))); self.mi.append(mi)
        return self

    def build(self, name, bevel=0.0, coll=None):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f); me.update()
        for m in self.mats: me.materials.append(m)
        me.polygons.foreach_set("material_index", self.mi)
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


def blob(name, center, radius, mat, seed, coll=None, squash=1.0, fine=False):
    """나무 수관: 이코스피어를 구름 텍스처 두 겹으로 밀어 잎 덩어리를 만든다."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4 if fine else 3, radius=radius, location=center)
    ob = bpy.context.object; ob.name = name
    ob.scale = (1, 1, squash)
    tex = bpy.data.textures.new(f"{name} lumps", "CLOUDS"); tex.noise_scale = .55 * radius; tex.noise_depth = 2
    md = ob.modifiers.new("lumps", "DISPLACE"); md.texture = tex; md.strength = .45 * radius; md.mid_level = .5
    md.texture_coords = "OBJECT"
    if fine:
        t2 = bpy.data.textures.new(f"{name} leaves", "CLOUDS"); t2.noise_scale = .09; t2.noise_depth = 1
        m2 = ob.modifiers.new("leaves", "DISPLACE"); m2.texture = t2; m2.strength = .16; m2.mid_level = .5; m2.texture_coords = "OBJECT"
    ob.data.materials.append(mat)
    for p in ob.data.polygons: p.use_smooth = True
    if coll is not None:
        for c in list(ob.users_collection): c.objects.unlink(ob)
        coll.objects.link(ob)
    return ob


def area_light(name, loc, size, energy_samples, color=WARM, shape="RECTANGLE", rot=(0, 0, 0), coll=None):
    ld = bpy.data.lights.new(name, "AREA"); ld.shape = shape
    ld.size, ld.size_y = size
    ld.color = color; ld.energy = 0.0
    try: ld.cycles.cast_shadow = True
    except Exception: pass
    ob = put(bpy.data.objects.new(name, ld), coll)
    ob.location = loc; ob.rotation_euler = rot
    bake(ld, "energy", energy_samples)
    return ob


# ── 부품과 비행 ───────────────────────────────────────────────────────
PARTS = []


class Part:
    """부품 하나. 빈 오브젝트를 부모로 두고, 그 부모만 날린다."""
    def __init__(self, name, pivot, frames, come_from, spin=(0, 0, 0), arc=0.0, land="settle"):
        self.name, self.frames, self.dir, self.spin, self.arc, self.land = name, frames, Vector(come_from), Vector(spin), arc, land
        self.root = put(bpy.data.objects.new(f"part · {name}", None))
        self.root.empty_display_size = 1
        self.pivot = Vector(pivot)
        self.root.location = self.pivot
        self.children = []
        PARTS.append(self)

    def adopt(self, *obs):
        # matrix_world는 depsgraph가 돌기 전엔 갱신되지 않으므로 역행렬을 직접 만든다.
        inv = Matrix.Translation(self.pivot).inverted()
        for ob in obs:
            ob.parent = self.root
            ob.matrix_parent_inverse = inv
            self.children.append(ob)
        return self


def lit_curve(f_on0, f_on1, peak=1.0):
    return [(f, peak * ramp(f, f_on0, f_on1, ease_io)) for f in sorted({0, *span(f_on0, f_on1), LAST})]


# ── 집 ───────────────────────────────────────────────────────────────
# 좌표: X 동쪽, Y 북쪽, Z 위. 정면은 남쪽(-Y). 단위는 미터.
def build_house():
    # 1 · 기초(위에서)
    p = Part("plinth", (0, 0, .35), (6, 30), (0, 0, 1), spin=(.05, -.03, 0), land="heavy")
    base = Builder(CONCRETE_DARK, PAVING).box(-12, 12, -6.5, 6.5, 0, .68, 0).box(-11.92, 11.92, -6.42, 6.42, .68, .7, 1).build("plinth", bevel=.02)
    p.adopt(base)

    # 2 · 코어 벽(왼쪽에서): 수직 틈창이 있는 노출 콘크리트
    p = Part("core", (-9.25, 0, 4.7), (20, 50), (-1, -.15, .18), spin=(0, 0, -.14), arc=3.0)
    core = (Builder(CONCRETE)
            .box(-11, -9.7, -4.8, 4.8, .7, 8.7).box(-8.9, -7.5, -4.8, 4.8, .7, 8.7)
            .box(-9.7, -8.9, -4.8, 4.8, .7, 1.25).box(-9.7, -8.9, -4.8, 4.8, 8.05, 8.7)
            .box(-9.7, -8.9, -4.2, 4.8, 1.25, 8.05)
            .build("core", bevel=.015))
    slot = Builder(SLOTGLOW).quad([(-9.7, -4.21, 1.25), (-8.9, -4.21, 1.25), (-8.9, -4.21, 8.05), (-9.7, -4.21, 8.05)]).build("core slot light")
    wash = area_light("core wash", (-9.3, -6.2, .9), (3.2, .4), lit_curve(222, 246, 180), color=(1.0, .7, .45), rot=(math.radians(150), 0, 0))
    p.adopt(core, slot, wash)
    PROPS.append((slot, "lit", lit_curve(220, 244)))

    # 3 · 1층 유리 상자(오른쪽에서): 유리·멀리언·실내
    p = Part("ground glass", (0, 0, 2.4), (34, 64), (1, .1, .12), spin=(0, 0, .1), arc=2.0)
    gl = Builder(GLASS).box(-7.5, 7, -4.2, -4.18, .72, 4.1).box(6.98, 7, -4.18, 4.0, .72, 4.1).build("ground glazing")
    fr = Builder(METAL)
    for x in [-7.5 + i * 1.8125 for i in range(9)]:
        fr.box(x - .03, x + .03, -4.26, -4.14, .7, 4.1)
    for y in [-4.2 + i * 1.64 for i in range(6)]:
        fr.box(6.94, 7.06, y - .03, y + .03, .7, 4.1)
    fr.box(-7.5, 7.06, -4.28, -4.12, .7, .8).box(-7.5, 7.06, -4.28, -4.12, 4.0, 4.1)
    fr.box(6.92, 7.08, -4.28, 4.0, .7, .8).box(6.92, 7.08, -4.28, 4.0, 4.0, 4.1)
    frame = fr.build("ground frame")
    back = Builder(PLASTER, CONCRETE).box(-7.5, 7, 4.0, 4.2, .7, 4.1, 0).build("ground back wall")
    inside = (Builder(OAK, FABRIC, DARKWOOD, STONE_TOP, PLASTER)
              .box(-7.45, 6.95, -4.15, 3.98, .7, .72, 0)
              # 소파·러그·테이블
              .box(-5.0, -.6, -3.7, -.4, .72, .735, 1)
              .box(-4.6, -1.0, -1.5, -.7, .72, 1.16, 1).box(-4.6, -1.0, -.72, -.42, .72, 1.55, 1).box(-4.9, -4.55, -3.2, -.42, .72, 1.16, 1)
              .box(-3.5, -2.1, -2.9, -2.1, .72, 1.08, 2)
              # 식탁과 의자
              .box(1.4, 4.6, -1.3, .2, 1.42, 1.48, 2).box(1.5, 1.62, -1.2, .1, .72, 1.42, 2).box(4.38, 4.5, -1.2, .1, .72, 1.42, 2)
              .box(1.7, 2.2, -1.95, -1.5, .72, 1.25, 1).box(2.8, 3.3, -1.95, -1.5, .72, 1.25, 1).box(3.9, 4.4, -1.95, -1.5, .72, 1.25, 1)
              .box(1.7, 2.2, .4, .85, .72, 1.25, 1).box(2.8, 3.3, .4, .85, .72, 1.25, 1).box(3.9, 4.4, .4, .85, .72, 1.25, 1)
              # 주방 아일랜드와 벽장
              .box(1.0, 5.4, 2.1, 3.0, .72, 1.62, 3).box(-2.0, 6.9, 3.4, 3.98, .72, 3.2, 4)
              .build("ground interior", bevel=.01))
    pend = Builder(PENDANT)
    for x in (2.1, 3.0, 3.9):
        pend.box(x - .16, x + .16, -.71, -.39, 2.55, 2.75)
    pend = pend.build("dining pendants")
    lamp = Builder(PENDANT).box(-5.55, -5.25, -1.1, -.8, 2.0, 2.3).build("floor lamp shade")
    stem = cylinder("floor lamp stem", -5.4, -.95, .72, 2.0, .018, METAL)
    light = area_light("ground ceiling", (0, 0, 4.0), (13.0, 7.2), lit_curve(212, 244, 900))
    p.adopt(gl, frame, back, inside, pend, lamp, stem, light)
    PROPS.append((pend, "lit", lit_curve(214, 240)))
    PROPS.append((lamp, "lit", lit_curve(218, 242)))

    # 4 · 2층 바닥 슬래브(위에서)
    p = Part("slab", (0, 0, 4.3), (50, 74), (0, 0, 1), spin=(-.04, .03, 0), land="heavy")
    slab = Builder(SLAB).box(-7.5, 9.2, -5.2, 5.2, 4.1, 4.5).build("slab", bevel=.012)
    soffit = Builder(DOWNLIGHT)
    for x in [-5.5 + i * 2.2 for i in range(7)]:
        soffit.box(x - .1, x + .1, -4.85, -4.65, 4.09, 4.1)
    for y in (-3.0, -1.0, 1.0, 3.0):
        soffit.box(8.0, 8.2, y - .1, y + .1, 4.09, 4.1)
    soffit = soffit.build("slab downlights")
    p.adopt(slab, soffit)
    PROPS.append((soffit, "lit", lit_curve(226, 248)))

    # 5 · 2층 목재 상자(오른쪽에서, 캔틸레버)
    p = Part("upper box", (4.75, 0, 6.3), (88, 126), (1, .05, .1), spin=(0, 0, .06), arc=4.0)
    shell = (Builder(WOOD, SLAB, OAK, PLASTER)
             .box(-7.5, 17, -3.7, 3.7, 4.5, 4.72, 1)                      # 바닥판
             .box(-7.5, 17, 3.5, 3.7, 4.72, 8.1, 3)                       # 북쪽 벽 안쪽
             .box(-7.5, .5, -3.7, -3.5, 4.72, 8.1, 3).box(13, 17, -3.7, -3.5, 4.72, 8.1, 3)
             .box(.5, 13, -3.7, -3.5, 4.72, 5.2, 3).box(.5, 13, -3.7, -3.5, 7.6, 8.1, 3)
             .box(-7.5, 17, -3.5, 3.5, 7.92, 8.1, 3)                      # 천장
             .box(-7.4, 16.9, -3.45, 3.45, 4.72, 4.74, 2)                 # 마루
             .build("upper shell", bevel=.01))
    cl = Builder(WOOD)
    x = -7.5
    while x < 17 - .05:
        if not (.5 < x < 13 - .07):
            cl.box(x, x + .075, -3.84, -3.7, 4.5, 8.1)
        cl.box(x, x + .075, 3.7, 3.84, 4.5, 8.1)
        x += .165
    for z0 in (4.5, 4.74, 4.98):
        cl.box(.5, 13, -3.84, -3.7, z0, z0 + .2)
    for z0 in (7.62, 7.86):
        cl.box(.5, 13, -3.84, -3.7, z0, z0 + .2)
    # 캔틸레버 아랫면(목재 널)
    xx = 9.2
    while xx < 17:
        cl.box(xx, xx + .16, -3.84, 3.84, 4.46, 4.5)
        xx += .2
    cladding = cl.build("cedar slats")
    under = Builder(DOWNLIGHT)
    for x in (10.4, 12.2, 14.0, 15.8):
        for y in (-1.8, 1.8):
            under.box(x - .09, x + .09, y - .09, y + .09, 4.445, 4.455)
    under = under.build("cantilever downlights")
    room = (Builder(FABRIC, DARKWOOD, PLASTER, OAK)
            .box(12.6, 15.6, -1.3, 1.3, 4.74, 5.22, 0).box(15.6, 15.8, -1.4, 1.4, 4.74, 5.9, 1)
            .box(2.6, 6.2, -3.3, -2.6, 5.45, 5.5, 3).box(2.7, 2.78, -3.25, -2.65, 4.74, 5.45, 1).box(6.02, 6.1, -3.25, -2.65, 4.74, 5.45, 1)
            .box(-6.0, 11.5, 3.05, 3.5, 4.74, 7.6, 2)
            .box(8.0, 9.0, -2.2, -1.2, 4.74, 5.35, 0)
            .build("upper room", bevel=.01))
    books = Builder(FABRIC, DARKWOOD, STONE_TOP)
    r = random.Random(4)
    for shelf in (5.3, 6.1, 6.9):
        bx = -5.8
        while bx < 11.2:
            w = r.uniform(.05, .11); h = r.uniform(.45, .68)
            if r.random() > .18:
                books.box(bx, bx + w, 3.02, 3.26, shelf, shelf + h, r.randrange(3))
            bx += w + r.uniform(.0, .03)
    books = books.build("books")
    upper_panel = Builder(PANEL)
    for x in (-3.0, 2.0, 7.0, 12.0):
        upper_panel.box(x - 1.6, x + 1.6, -1.0, 1.0, 7.9, 7.92)
    upper_panel = upper_panel.build("upper diffusers")
    desk_lamp = Builder(PENDANT).box(5.6, 5.85, -3.1, -2.85, 5.5, 5.72).build("desk lamp")
    lamp2 = Builder(PENDANT).box(12.3, 12.55, 1.5, 1.75, 5.3, 5.55).build("bedside lamp")
    upper_light = area_light("upper ceiling", (4.75, 0, 7.85), (23.0, 6.4), lit_curve(216, 246, 1300))
    p.adopt(shell, cladding, under, room, books, upper_panel, desk_lamp, lamp2, upper_light)
    PROPS.append((under, "lit", lit_curve(228, 250)))
    PROPS.append((upper_panel, "lit", lit_curve(216, 244)))
    PROPS.append((desk_lamp, "lit", lit_curve(220, 244)))
    PROPS.append((lamp2, "lit", lit_curve(222, 246)))

    # 6 · 2층 유리(왼쪽 앞에서)
    p = Part("upper glass", (9, -2, 6.3), (112, 142), (-1, -.55, .3), spin=(.05, 0, -.1), arc=2.5)
    ug = Builder(GLASS).box(.5, 13, -3.72, -3.7, 5.2, 7.6).box(16.98, 17.0, -3.7, 3.7, 4.72, 8.1).build("upper glazing")
    uf = Builder(METAL)
    for x in [.5 + i * 2.083 for i in range(7)]:
        uf.box(x - .03, x + .03, -3.78, -3.66, 5.2, 7.6)
    uf.box(.5, 13, -3.8, -3.66, 5.16, 5.24).box(.5, 13, -3.8, -3.66, 7.56, 7.64)
    for y in (-3.7, -1.23, 1.23, 3.7):
        uf.box(16.96, 17.08, y - .035, y + .035, 4.6, 8.1)
    uf.box(16.94, 17.1, -3.84, 3.84, 4.5, 4.66).box(16.94, 17.1, -3.84, 3.84, 7.98, 8.14)
    p.adopt(ug, uf.build("upper frame"))

    # 7 · 지붕(위에서)
    p = Part("roof", (4.85, 0, 8.25), (130, 156), (0, 0, 1), spin=(.03, .05, 0), land="heavy")
    roof = Builder(textured("roof membrane", (.05, .05, .052), (.09, .09, .092), rough=.85, scale=6, bump=.05, variation=False), METAL)
    roof.box(-7.7, 17.4, -4.1, 4.1, 8.1, 8.36, 0)
    roof.box(-7.75, 17.45, -4.15, -4.08, 8.05, 8.44, 1).box(-7.75, 17.45, 4.08, 4.15, 8.05, 8.44, 1)
    roof.box(17.38, 17.45, -4.15, 4.15, 8.05, 8.44, 1).box(-7.75, -7.68, -4.15, 4.15, 8.05, 8.44, 1)
    roof = roof.build("roof", bevel=.01)
    led = Builder(LEDSTRIP).box(-7.5, 17.2, -4.02, -3.96, 8.085, 8.1).box(17.2, 17.26, -3.9, 3.9, 8.085, 8.1).build("roof edge led")
    p.adopt(roof, led)
    PROPS.append((led, "lit", lit_curve(230, 250)))

    # 8 · 목재 데크(오른쪽에서)와 반사 연못(왼쪽에서)
    p = Part("deck", (9.5, -7.45, .22), (172, 200), (1, -.2, .1), arc=1.2)
    deck = Builder(WOOD)
    yy = -8.4
    while yy < -6.5:
        deck.box(-2, 21, yy, yy + .17, 0, .45)
        yy += .19
    p.adopt(deck.build("deck boards"))
    p = Part("pool", (9.5, -10.9, .22), (178, 206), (-1, -.3, .08), arc=1.0)
    pool = (Builder(PAVING, pool_tile())
            .box(-2, 21, -13.6, -12.2, 0, .45, 0).box(-2, 3, -12.2, -8.4, 0, .45, 0).box(19, 21, -12.2, -8.4, 0, .45, 0)
            .box(3, 19, -12.2, -8.4, 0, .06, 1)
            .build("pool coping", bevel=.01))
    lamps = [area_light(f"pool lamp {k}", (x, -8.55, .24), (.35, .35), lit_curve(212 + k * 3, 238 + k * 3, 55), color=(.55, .92, 1.0),
                        rot=(math.radians(-100), 0, 0)) for k, x in enumerate((5.5, 9.5, 13.5, 17.0))]
    p.adopt(pool, *lamps)
    PROPS.append((pool, "lit", lit_curve(212, 240)))
    p = Part("water", (11, -10.3, .41), (200, 218), (0, 0, -1), land="rise")
    wt = Builder(WATER).quad([(3, -12.2, .41), (19, -12.2, .41), (19, -8.4, .41), (3, -8.4, .41)]).build("water")
    p.adopt(wt)

    # 9 · 선베드
    p = Part("loungers", (16.2, -7.4, .45), (206, 224), (0, 0, 0), land="pop")
    lg = Builder(DARKWOOD, FABRIC)
    for x0 in (14.2, 16.6):
        lg.box(x0, x0 + .75, -8.15, -6.65, .45, .72, 0).box(x0 + .04, x0 + .71, -8.1, -6.9, .72, .82, 1)
        lg.box(x0 + .04, x0 + .71, -6.95, -6.62, .72, 1.3, 1)
    p.adopt(lg.build("loungers", bevel=.01))


# ── 조경 ─────────────────────────────────────────────────────────────
TREE_MESHES = []


def tree_template(i, coll):
    """0·1은 기둥 모양 사이프러스, 2는 가지가 벌어진 활엽수. 조각들을 한 메시로 합쳐 공원 나무가 공유한다."""
    r = random.Random(40 + i)
    parts = [cylinder(f"trunk {i}", 0, 0, 0, 2.2 if i < 2 else 4.2, .12 if i < 2 else .17, BARK, seg=10, coll=coll)]
    if i < 2:
        height = 10.5 if i == 0 else 8.2
        n = 16
        for k in range(n):
            t = k / (n - 1)
            rad = (1.2 if i == 0 else 1.0) * (1 - .8 * t ** 1.6) * (1 - .25 * (1 - t) ** 6)
            c = (r.uniform(-.1, .1), r.uniform(-.1, .1), 1.4 + t * (height - 2.0))
            parts.append(blob(f"crown {i}.{k}", c, max(.22, rad), LEAF, i * 10 + k, coll=coll, squash=1.25, fine=True))
    else:
        for k in range(15):
            a = r.uniform(0, math.tau); d = r.uniform(0, 2.4)
            c = (d * math.cos(a), d * math.sin(a), r.uniform(4.2, 7.4) - d * .35)
            parts.append(blob(f"crown {i}.{k}", c, r.uniform(.75, 1.25), LEAF, i * 10 + k, coll=coll, squash=.78, fine=True))
        for k in range(3):
            a = k / 3 * math.tau + .4
            parts.append(branch(f"branch {i}.{k}", (0, 0, 3.4), (1.6 * math.cos(a), 1.6 * math.sin(a), 5.6), coll))
    dg = bpy.context.evaluated_depsgraph_get()
    verts, faces, mats, smooth = [], [], [], []
    for n, ob in enumerate(parts):
        ev = ob.evaluated_get(dg); me = ev.to_mesh()
        o = len(verts)
        verts += [tuple(ob.matrix_world @ v.co) for v in me.vertices]
        leaf = ob.name.startswith("crown")
        for p in me.polygons:
            faces.append(tuple(o + i for i in p.vertices)); mats.append(1 if leaf else 0); smooth.append(True)
        ev.to_mesh_clear()
    me = bpy.data.meshes.new(f"tree {i}")
    me.from_pydata(verts, [], faces); me.update()
    me.materials.append(BARK); me.materials.append(LEAF)
    me.polygons.foreach_set("material_index", mats); me.polygons.foreach_set("use_smooth", smooth)
    return me


def branch(name, a, b, coll):
    a, b = Vector(a), Vector(b)
    ob = cylinder(name, 0, 0, 0, (b - a).length, .07, BARK, seg=8, coll=coll)
    ob.location = a
    ob.rotation_mode = "QUATERNION"; ob.rotation_quaternion = (b - a).to_track_quat("Z", "Y")
    return ob


def build_landscape():
    hidden = bpy.data.collections.new("tree templates"); S.collection.children.link(hidden)
    hidden.hide_render = True; hidden.hide_viewport = True
    for i in range(3):
        TREE_MESHES.append(tree_template(i, hidden))

    def tree_at(name, x, y, s, rot, coll=None, kind=None):
        k = kind if kind is not None else (2 if zlib.crc32(name.encode()) % 10 < 7 else zlib.crc32(name.encode()) % 2)
        ob = put(bpy.data.objects.new(name, TREE_MESHES[k]), coll)
        ob.location = (x, y, 0); ob.scale = (s, s, s); ob.rotation_euler = (0, 0, rot)
        return ob

    # 집 주변 나무: 완성 직전에 자라난다
    p = Part("garden trees", (0, 0, 0), (188, 234), (0, 0, 0), land="grow")
    garden = [(-15.5, 10.5, 1.05), (-21.0, 6.0, 1.15), (24.5, 7.5, 1.1), (29.0, 9.5, .95), (7.0, 12.0, 1.05), (-4.0, 13.0, .9), (15.0, 11.5, .95)]
    for i, (x, y, s) in enumerate(garden):
        t = tree_at(f"garden tree {i}", x, y, s, i * 1.3, kind=i % 2)
        p.adopt(t)
        t.matrix_parent_inverse = Matrix()
        GROW.append((t, 188 + i * 6, s))

    # 공원 나무: 처음부터 있다
    r = random.Random(7)
    placed = 0
    while placed < 130:
        x, y = r.uniform(-300, 300), r.uniform(-150, 350)
        if abs(x) < 48 and -34 < y < 30: continue
        if abs(x - 30) < 30 and -40 < y < -10: continue
        tree_at(f"park tree {placed}", x, y, r.uniform(.85, 1.5), r.uniform(0, 6.28))
        placed += 1

    # 먼 산 능선: 사인파 여러 겹으로 만든 고리. 안개에 묻혀 지평선의 실루엣만 남는다.
    rr = random.Random(3)
    waves = [(k, amp, rr.uniform(0, math.tau)) for k, amp in ((2, 70), (5, 60), (11, 34), (23, 18), (53, 9), (131, 4))]
    ring = Builder(principled("far ridge", (.012, .014, .017), rough=1.0))
    n, R = 900, 3900.0
    for i in range(n):
        a0, a1 = i / n * math.tau, (i + 1) / n * math.tau
        h0, h1 = [40 + sum(amp * abs(math.sin(k * a + ph)) for k, amp, ph in waves) for a in (a0, a1)]
        p = lambda a, z: (R * math.cos(a), R * math.sin(a) + 300, z)
        ring.quad([p(a0, -20), p(a1, -20), p(a1, h1), p(a0, h0)])
    ring.build("far ridge")

    # 바닥: 공원은 잔디, 도시 구역은 아스팔트, 연못 자리를 비운다
    ground_mat = bpy.data.materials.new("ground")
    N, L = tree_of(ground_mat)
    b = N["Principled BSDF"]
    geo = N.new("ShaderNodeNewGeometry"); sep = N.new("ShaderNodeSeparateXYZ"); L.new(geo.outputs["Position"], sep.inputs[0])
    city = N.new("ShaderNodeMapRange"); city.inputs["From Min"].default_value = 352; city.inputs["From Max"].default_value = 372
    L.new(sep.outputs["Y"], city.inputs["Value"])
    lawn_col = N.new("ShaderNodeTexNoise"); lawn_col.inputs["Scale"].default_value = .08; lawn_col.inputs["Detail"].default_value = 6
    cr = N.new("ShaderNodeValToRGB"); cr.color_ramp.elements[0].color = (.018, .036, .013, 1); cr.color_ramp.elements[1].color = (.045, .075, .028, 1)
    L.new(lawn_col.outputs["Fac"], cr.inputs["Fac"])
    fac, ma, mb, mo = mix_rgb(N)
    mb.default_value = (.018, .019, .021, 1)
    L.new(city.outputs["Result"], fac); L.new(cr.outputs["Color"], ma)
    L.new(mo, b.inputs["Base Color"])
    rough = N.new("ShaderNodeMapRange"); rough.inputs["To Min"].default_value = .95; rough.inputs["To Max"].default_value = .55
    L.new(city.outputs["Result"], rough.inputs["Value"]); L.new(rough.outputs["Result"], b.inputs["Roughness"])
    bp = N.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = .25
    fine = N.new("ShaderNodeTexNoise"); fine.inputs["Scale"].default_value = 3.0; fine.inputs["Detail"].default_value = 8
    L.new(fine.outputs["Fac"], bp.inputs["Height"]); L.new(bp.outputs["Normal"], b.inputs["Normal"])
    E = 6000
    Builder(ground_mat).quad([(-E, -E, 0), (E, -E, 0), (E, E, 0), (-E, E, 0)]).build("ground")


# ── 평면선(청사진) ───────────────────────────────────────────────────
def build_blueprint():
    b = Builder(BLUEPRINT)
    z, w = .025, .06

    def line(x0, y0, x1, y1, width=w):
        dx, dy = x1 - x0, y1 - y0; n = math.hypot(dx, dy); nx, ny = -dy / n * width / 2, dx / n * width / 2
        b.quad([(x0 + nx, y0 + ny, z), (x0 - nx, y0 - ny, z), (x1 - nx, y1 - ny, z), (x1 + nx, y1 + ny, z)])

    def rect(x0, y0, x1, y1, width=w):
        line(x0, y0, x1, y0, width); line(x1, y0, x1, y1, width); line(x1, y1, x0, y1, width); line(x0, y1, x0, y0, width)

    def dashed(x0, y0, x1, y1, dash=.6, gap=.35):
        n = math.hypot(x1 - x0, y1 - y0); t = 0
        while t < n:
            t1 = min(n, t + dash); a, c = t / n, t1 / n
            line(lerp(x0, x1, a), lerp(y0, y1, a), lerp(x0, x1, c), lerp(y0, y1, c), .045)
            t += dash + gap

    rect(-12, -6.5, 12, 6.5, .08)
    rect(-11, -4.8, -7.5, 4.8)
    rect(-7.5, -4.2, 7, 4.0)
    for x0, y0, x1, y1 in ((-7.5, -3.7, 17, -3.7), (17, -3.7, 17, 3.7), (17, 3.7, -7.5, 3.7)):
        dashed(x0, y0, x1, y1)
    # 치수선
    for x in (-12, 12):
        line(x, -15.2, x, -16.6, .04)
    line(-12, -15.9, 12, -15.9, .035)
    for y in (-6.5, 6.5):
        line(-14.2, y, -15.6, y, .04)
    line(-14.9, -6.5, -14.9, 6.5, .035)
    # 내부 격자
    for gx in range(-10, 12, 2):
        line(gx, -6.3, gx, 6.3, .018)
    for gy in range(-6, 7, 2):
        line(-11.8, gy, 11.8, gy, .018)
    ob = b.build("blueprint")
    PROPS.append((ob, "fade", [(0, 1.0), (10, 1.0), (60, .55), (100, .15), (140, 0.0), (LAST, 0.0)]))
    b = Builder(BLUEPRINT)
    rect(3, -12.2, 19, -8.4)
    rect(-2, -13.6, 21, -6.5, .04)
    pool_plan = b.build("blueprint pool")
    PROPS.append((pool_plan, "fade", [(0, 1.0), (10, 1.0), (84, .7), (168, .55), (186, .4), (206, 0.0), (LAST, 0.0)]))


# ── 도시 ─────────────────────────────────────────────────────────────
# 10×8 블록. 금색 개발자 구역(13블록)은 전체(80블록)의 16%: 3조 ÷ 18.6조 달러와 같은 비율이다.
# 나머지는 BofA의 7개 직군. 개발자는 IT 직군 안에 있다.
COLS, ROWS, PITCH, BLOCK = 10, 8, 60.0, 46.0
X0, Y0 = -270.0, 400.0
DEV = {(i, j) for j in (2, 3) for i in range(3, 8)} | {(4, 4), (5, 4), (6, 4)}
IT = DEV | {(3, 4), (7, 4), (5, 1)}
CITY_LABELS = {}
PULSE_POINTS = []


def field_of(i, j):
    if (i, j) in IT: return "it"
    if j <= 1: return "finance" if i <= 4 else "hr"
    if j <= 4: return "sales" if i <= 2 else "support"
    if j == 5: return "sales" if i <= 2 else "ops" if i <= 7 else "support"
    return "marketing" if i <= 4 else "ops" if i <= 7 else "support"


def building_material():
    """창은 월드 좌표 격자로 그린다. 사무동은 층 단위로, 주거동은 창 단위로 켜진다."""
    m = bpy.data.materials.new("city facade")
    N, L = tree_of(m)
    b = N["Principled BSDF"]
    geo = N.new("ShaderNodeNewGeometry"); sep = N.new("ShaderNodeSeparateXYZ"); L.new(geo.outputs["Position"], sep.inputs[0])
    nrm = N.new("ShaderNodeSeparateXYZ"); L.new(geo.outputs["Normal"], nrm.inputs[0])
    info = N.new("ShaderNodeObjectInfo")

    def attr(name):
        a = N.new("ShaderNodeAttribute"); a.attribute_type = "OBJECT"; a.attribute_name = name
        return a.outputs["Fac"]

    def M(op, a=None, c=None):
        n = N.new("ShaderNodeMath"); n.operation = op
        for k, v in enumerate((a, c)):
            if isinstance(v, (int, float)): n.inputs[k].default_value = v
            elif v is not None: L.new(v, n.inputs[k])
        return n.outputs[0]

    def band(x, lo, hi): return M("MULTIPLY", M("GREATER_THAN", x, lo), M("LESS_THAN", x, hi))

    def noise4(a, c, w):
        wn = N.new("ShaderNodeTexWhiteNoise"); wn.noise_dimensions = "4D"
        v = N.new("ShaderNodeCombineXYZ"); L.new(a, v.inputs[0]); L.new(c, v.inputs[1]); L.new(M("MULTIPLY", info.outputs["Random"], 131.0), v.inputs[2])
        L.new(v.outputs[0], wn.inputs["Vector"]); wn.inputs["W"].default_value = w
        return wn.outputs["Value"]

    office, lit, warm = attr("office"), attr("lit"), attr("warm")
    zf = M("DIVIDE", M("SUBTRACT", sep.outputs["Z"], .22), 3.5)
    floor, fz = M("FLOOR", zf), M("FRACT", zf)
    # 벽의 방향에 따라 가로 좌표를 고른다
    ax = M("GREATER_THAN", M("ABSOLUTE", nrm.outputs["X"]), .5)
    u = M("ADD", M("MULTIPLY", ax, sep.outputs["Y"]), M("MULTIPLY", M("SUBTRACT", 1, ax), sep.outputs["X"]))
    # 사무동: 1.5m 간격 커튼월, 층 전체가 켜진다
    uo = M("DIVIDE", u, 1.5); colo, fo = M("FLOOR", uo), M("FRACT", uo)
    win_o = M("MULTIPLY", band(fz, .1, .9), band(fo, .05, .95))
    floor_on = M("LESS_THAN", noise4(floor, M("MULTIPLY", colo, 0.0), 1.0), M("ADD", .3, M("MULTIPLY", info.outputs["Random"], .4)))
    bay_dark = M("GREATER_THAN", noise4(floor, M("FLOOR", M("DIVIDE", colo, 4.0)), 2.0), .14)
    on_o = M("MULTIPLY", floor_on, bay_dark)
    # 주거동: 2.6m 간격 창, 창마다 따로 켜진다
    ur = M("DIVIDE", u, 2.6); colr, fr = M("FLOOR", ur), M("FRACT", ur)
    win_r = M("MULTIPLY", band(fz, .3, .8), band(fr, .2, .78))
    on_r = M("LESS_THAN", noise4(floor, colr, 3.0), M("ADD", .16, M("MULTIPLY", info.outputs["Random"], .26)))
    wall = M("MULTIPLY", M("LESS_THAN", M("ABSOLUTE", nrm.outputs["Z"]), .5), M("GREATER_THAN", sep.outputs["Z"], 3.0))
    window = M("MULTIPLY", wall, M("ADD", M("MULTIPLY", office, win_o), M("MULTIPLY", M("SUBTRACT", 1, office), win_r)))
    on = M("ADD", M("MULTIPLY", office, on_o), M("MULTIPLY", M("SUBTRACT", 1, office), on_r))
    # 불이 켜지는 순서: 창마다 조금씩 늦게
    stagger = noise4(floor, colr, 4.0)
    ready = M("GREATER_THAN", M("SUBTRACT", M("MULTIPLY", lit, 1.25), M("MULTIPLY", stagger, .25)), .5)
    glow = M("MULTIPLY", M("MULTIPLY", window, on), ready)
    bright = M("ADD", .6, M("MULTIPLY", noise4(floor, colo, 5.0), .8))
    level = M("ADD", M("MULTIPLY", office, 2.1), M("MULTIPLY", M("SUBTRACT", 1, office), 2.7))
    old_em = M("MULTIPLY", M("MULTIPLY", glow, bright), level)
    cf, ca, cb, co = mix_rgb(N)
    ca.default_value = (.74, .85, 1.0, 1); cb.default_value = (1.0, .86, .68, 1)
    L.new(M("MAXIMUM", M("SUBTRACT", 1, office), M("GREATER_THAN", noise4(floor, colo, 6.0), .8)), cf)
    gf, ga, gb, go = mix_rgb(N)
    L.new(co, ga); gb.default_value = (1.0, .56, .16, 1)
    L.new(warm, gf)
    # 외벽: 사무동은 어두운 반사 유리, 주거동은 어두운 석재
    bf, ba, bb, bo = mix_rgb(N)
    ba.default_value = (.05, .046, .042, 1); bb.default_value = (.014, .018, .024, 1)
    L.new(M("MAXIMUM", office, M("MULTIPLY", window, .7)), bf)

    # 가까이서 볼 때의 창(교차로). Detail이 0이면 위의 값을 그대로 쓰므로 1~6단계와 8단계 화면은 변하지 않는다.
    # 창마다 실내 빛의 색온도와 밝기가 다르고, 천장 쪽이 밝으며, 절반쯤은 블라인드가 내려와 있고, 창틀이 보인다.
    det = N.new("ShaderNodeValue"); det.name = "Detail"; det.outputs[0].default_value = 0.0
    D = det.outputs[0]
    inv = M("SUBTRACT", 1, office)
    wu = M("ADD", M("MULTIPLY", office, M("DIVIDE", M("SUBTRACT", fo, .05), .9)), M("MULTIPLY", inv, M("DIVIDE", M("SUBTRACT", fr, .2), .58)))
    wv = M("ADD", M("MULTIPLY", office, M("DIVIDE", M("SUBTRACT", fz, .1), .8)), M("MULTIPLY", inv, M("DIVIDE", M("SUBTRACT", fz, .3), .5)))
    colw = M("ADD", M("MULTIPLY", office, colo), M("MULTIPLY", inv, colr))
    r1, r2, r3, r4 = (noise4(floor, colw, w) for w in (7.0, 8.0, 9.0, 10.0))
    ceiling = M("ADD", .5, M("MULTIPLY", wv, .5))
    blinds = M("MULTIPLY", M("LESS_THAN", r2, .5), M("GREATER_THAN", wv, M("SUBTRACT", 1, M("MULTIPLY", r3, .85))))
    slats = M("ADD", .16, M("MULTIPLY", M("GREATER_THAN", M("FRACT", M("MULTIPLY", wv, 18)), .55), .12))
    shade = M("SUBTRACT", 1, M("MULTIPLY", blinds, M("SUBTRACT", 1, slats)))
    frame_v = M("MULTIPLY", inv, band(wu, .48, .52))
    frame_h = band(wv, .66, .69)
    mull = M("SUBTRACT", 1, M("MINIMUM", 1, M("ADD", frame_v, frame_h)))
    vary = M("ADD", .35, M("MULTIPLY", r4, .75))
    new_em = M("MULTIPLY", M("MULTIPLY", M("MULTIPLY", old_em, ceiling), M("MULTIPLY", shade, mull)), M("MULTIPLY", vary, .55))
    em = N.new("ShaderNodeMix"); em.data_type = "FLOAT"
    L.new(D, sock(em.inputs, "Factor_Float")); L.new(old_em, sock(em.inputs, "A_Float")); L.new(new_em, sock(em.inputs, "B_Float"))
    L.new(sock(em.outputs, "Result_Float"), b.inputs["Emission Strength"])
    tint = N.new("ShaderNodeValToRGB"); tint.color_ramp.interpolation = "CONSTANT"
    tint.color_ramp.elements[0].position, tint.color_ramp.elements[0].color = 0.0, (1.0, .62, .34, 1)
    tint.color_ramp.elements[1].position, tint.color_ramp.elements[1].color = .42, (1.0, .82, .62, 1)
    e3 = tint.color_ramp.elements.new(.78); e3.color = (.76, .86, 1.0, 1)
    L.new(r1, tint.inputs["Fac"])
    hf, ha, hb, ho = mix_rgb(N)
    L.new(tint.outputs["Color"], ha); hb.default_value = (1.0, .56, .16, 1); L.new(warm, hf)
    xf, xa, xb, xo = mix_rgb(N)
    L.new(D, xf); L.new(go, xa); L.new(ho, xb)
    L.new(xo, b.inputs["Emission Color"])
    # 외벽은 가로등과 번짐에 회색으로 뜨지 않게 더 어둡게
    df, da, db, do = mix_rgb(N, "MULTIPLY")
    L.new(M("MULTIPLY", D, .6), df); L.new(bo, da); db.default_value = (0, 0, 0, 1)
    L.new(do, b.inputs["Base Color"])
    L.new(M("SUBTRACT", .78, M("MULTIPLY", M("MAXIMUM", office, window), .68)), b.inputs["Roughness"])
    b.inputs["Specular IOR Level"].default_value = .65
    no_emission_sampling(m)
    return m


def build_city():
    fac = building_material()
    # 가까이서 보는 창의 디테일: 480까지 0, 교차로로 내려오며 1, 집으로 돌아가며 다시 0
    bake(fac.node_tree, 'nodes["Detail"].outputs[0].default_value', [(f, street_window(f)) for f in sorted({0, *range(KEEP, LAST + 1, 2), LAST})])
    plot_mat = textured("sidewalk", (.05, .05, .052), (.085, .085, .09), rough=.75, scale=.4, bump=.05, variation=False)
    curb = emissive("street lights", (1.0, .74, .46), 3.2)
    beacon = emissive("aircraft light", (1.0, .12, .06), 60.0)
    roof_mat = principled("roof plant", (.03, .032, .035), rough=.7)
    unit = bpy.data.meshes.new("unit tower")
    unit.from_pydata([(-.5, -.5, 0), (.5, -.5, 0), (.5, .5, 0), (-.5, .5, 0), (-.5, -.5, 1), (.5, -.5, 1), (.5, .5, 1), (-.5, .5, 1)], [],
                     [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])
    unit.update(); unit.materials.append(fac)
    unit_roof = unit.copy(); unit_roof.materials.clear(); unit_roof.materials.append(roof_mat)
    unit_beacon = unit.copy(); unit_beacon.materials.clear(); unit_beacon.materials.append(beacon)
    r = random.Random(21)
    cx0, cy0 = X0 + PITCH * (COLS - 1) / 2, Y0 + PITCH * (ROWS - 1) / 2
    dev_c = Vector((X0 + PITCH * 5.0, Y0 + PITCH * 2.9, 0))
    groups = {}
    rise_ease = lambda t: ease_out(t, 3.2)

    def tower(name, x, y, w, d, h, z0, f0, f1, lit0, lit1, is_dev, office):
        ob = put(bpy.data.objects.new(name, unit))
        ob.location = (x, y, z0)
        ob["warm"] = 1.0 if is_dev else 0.0
        ob["office"] = 1.0 if office else 0.0
        fr = [0, *span(f0, f1), LAST]
        bake(ob, "scale", [(0, w), (LAST, w)], index=0)
        bake(ob, "scale", [(0, d), (LAST, d)], index=1)
        bake(ob, "scale", [(f, max(.001, h * ramp(f, f0, f1, rise_ease))) for f in fr], index=2)
        prop(ob, "lit", [(0, 0), (lit0, 0), *[(f, ramp(f, lit0, lit1)) for f in span(lit0, lit1)], (LAST, 1)])
        hide_until(ob, f0)
        return ob

    def on_roof(name, mesh, x, y, w, d, h, base_z, top_h, f0, f1, appear):
        ob = put(bpy.data.objects.new(name, mesh))
        ob.scale = (w, d, h)
        ob.location = (x, y, base_z + top_h)
        fr = [0, *span(f0, f1), LAST]
        bake(ob, "location", [(f, base_z + top_h * ramp(f, f0, f1, rise_ease)) for f in fr], index=2)
        hide_until(ob, appear)
        return ob

    for i in range(COLS):
        for j in range(ROWS):
            cx, cy = X0 + i * PITCH, Y0 + j * PITCH
            fld = field_of(i, j); is_dev = (i, j) in DEV
            groups.setdefault(fld, []).append((cx, cy))
            dist = (Vector((cx, cy, 0)) - dev_c).length
            rise0 = (280 + dist * .08 + r.uniform(0, 4)) if is_dev else (344 + max(0.0, dist - 60) * .055 + r.uniform(0, 4))
            core = math.exp(-((cx - cx0) ** 2 + (cy - cy0) ** 2) / (2 * 170 ** 2))
            plot = Builder(plot_mat).box(cx - BLOCK / 2, cx + BLOCK / 2, cy - BLOCK / 2, cy + BLOCK / 2, 0, .22).build(f"plot {i},{j}")
            hide_until(plot, int(rise0) - 2)
            lights = Builder(curb)
            for sgn in (-1, 1):
                o = sgn * (BLOCK / 2 + .7)
                lights.box(cx - BLOCK / 2, cx + BLOCK / 2, cy + o - .07, cy + o + .07, .01, .04)
                lights.box(cx + o - .07, cx + o + .07, cy - BLOCK / 2, cy + BLOCK / 2, .01, .04)
            lights = lights.build(f"curb {i},{j}")
            hide_until(lights, int(rise0) - 2)
            PROPS.append((lights, "lit", [(0, 0), (int(rise0 + 8), 0), (int(rise0 + 30), 1), (KEEP, 1),
                                          *[(f, 1 - .55 * street_window(f)) for f in range(KEEP + 2, LAST, 4)], (LAST, 1)]))
            # 블록 유형
            kind = r.random()
            lots = []   # (x, y, w, d, h, office)
            if kind < .3:
                lots.append((cx, cy, 42, 42, r.uniform(8, 14), False))
                tw = r.uniform(19, 26)
                lots.append((cx + r.uniform(-5, 5), cy + r.uniform(-5, 5), tw, tw * r.uniform(.8, 1.25), (48 + 128 * core) * r.uniform(.6, 1.1), True))
            elif kind < .55:
                for sx in (-1, 1):
                    lots.append((cx + sx * 11.5, cy, r.uniform(17, 20), r.uniform(34, 42), (22 + 80 * core) * r.uniform(.5, 1.15), r.random() < .5))
            elif kind < .85:
                for sx in (-1, 1):
                    for sy in (-1, 1):
                        lots.append((cx + sx * 11.5, cy + sy * 11.5, r.uniform(15, 19), r.uniform(15, 19), (18 + 62 * core) * r.uniform(.5, 1.2), r.random() < .3))
            else:
                hh = (16 + 30 * core) * r.uniform(.7, 1.1)
                lots.append((cx, cy - 16.5, 44, 12, hh, False)); lots.append((cx, cy + 16.5, 44, 12, hh * r.uniform(.8, 1.2), False))
                lots.append((cx - 16.5, cy, 12, 20, hh * .9, False)); lots.append((cx + 16.5, cy, 12, 20, hh * 1.1, False))
            top = 0.0
            for k, (x, y, w, d, h, office) in enumerate(lots):
                h = max(9.0, h) * (1.1 if is_dev else 1.0)
                f0 = int(rise0 + k * 4); f1 = int(f0 + r.uniform(20, 24))
                lit0 = f1 - 4; lit1 = lit0 + 10
                tower(f"bldg {i},{j}.{k}", x, y, w, d, h, .22, f0, f1, lit0, lit1, is_dev, office)
                top = max(top, h)
                if h > 70:
                    # 옥탑 설비와 항공 장애등
                    tw2, td2 = w * r.uniform(.35, .55), d * r.uniform(.3, .5)
                    on_roof(f"roof box {i},{j}.{k}", unit_roof, x + r.uniform(-w, w) * .15, y + r.uniform(-d, d) * .15, tw2, td2, r.uniform(3, 6), .22, h, f0, f1, f1 - 6)
                    if h > 120:
                        on_roof(f"beacon {i},{j}.{k}", unit_beacon, x, y, .9, .9, .9, .22, h + 6, f0, f1, f1)
                if h > 45:
                    PULSE_POINTS.append(Vector((x, y, h + 2)))
    for fld, pts in groups.items():
        c = sum((Vector((x, y, 0)) for x, y in pts), Vector()) / len(pts)
        CITY_LABELS[fld] = Vector((c.x, c.y, 40))
    dc = sum((Vector((X0 + i * PITCH, Y0 + j * PITCH, 0)) for i, j in DEV), Vector()) / len(DEV)
    CITY_LABELS["dev"] = Vector((dc.x, dc.y, 60))
    # 0단계의 평면선을 도시 규모로 반복한다. 금색 구역이 서는 동안 나머지 블록은 선으로만 있다.
    plan = Builder(BLUEPRINT)
    for i in range(COLS):
        for j in range(ROWS):
            if (i, j) in DEV: continue
            cx, cy, h, t = X0 + i * PITCH, Y0 + j * PITCH, BLOCK / 2, .32
            for x0, y0, x1, y1 in ((cx - h, cy - h, cx + h, cy - h + t), (cx - h, cy + h - t, cx + h, cy + h), (cx - h, cy - h, cx - h + t, cy + h), (cx + h - t, cy - h, cx + h, cy + h)):
                plan.quad([(x0, y0, .03), (x1, y0, .03), (x1, y1, .03), (x0, y1, .03)])
    plan = plan.build("city plan")
    hide_until(plan, 256)
    PROPS.append((plan, "fade", [(0, 0), (256, 0), (300, .5), (344, .5), (372, .28), (410, 0), (LAST, 0)]))
    print("CITY", {k: len(v) for k, v in groups.items()}, "dev", len(DEV), "pulse towers", len(PULSE_POINTS))


def hide_until(ob, f):
    ob.hide_render = True
    bake(ob, "hide_render", [(0, 1), (max(0, f - 1), 1), (f, 0), (LAST, 0)], interp="CONSTANT")


# ── 교차로(7단계): 판단이 길 위로 ─────────────────────────────────────
# 카메라가 동서 길을 따라 내려와 3·4열 사이 남북 대로와 만나는 교차로 앞에 선다.
# 자율주행차는 우회전할지, 사족 로봇은 계단을 오를지 정한다. 판단마다 빛 한 줄기가 하늘로 오른다(도식).
# 움직임은 모두 t = f - STREET 의 함수이고, 화면은 LOOP 프레임마다 똑같이 돌아온다.
# 그래서 정지 지점에서는 같은 카메라로 렌더한 LOOP 프레임짜리 반복 영상이 끊김 없이 이어진다.
# 새로 놓는 것은 모두 STREET_ON부터 보이고 집으로 돌아오기 전에 사라진다(1~6단계와 8단계 화면은 그대로).
AVE_X, ST_Y = X0 + PITCH * 3.5, Y0 + PITCH * .5          # -60, 430
NB, SB, EB, WB = AVE_X + 1.75, AVE_X - 1.75, ST_Y - 1.75, ST_Y + 1.75   # 차선 중심
CURB_W, CURB_E, CURB_S, CURB_N = AVE_X - 7, AVE_X + 7, ST_Y - 7, ST_Y + 7
STREET, STREET_ON, STREET_OFF, LOOP = ANCHORS[7], ANCHORS[6] + 1, ANCHORS[8] - 30, 240
STREET_EXPOSURE = .6
STREET_HAZE = 4.5
STREET_BLOOM = .2
# 계단: 남서쪽 사무동(3,0.1)의 북쪽 면 앞. 로봇은 북쪽 보도를 따라 동쪽으로 오다 남쪽으로 돌아 오른다.
STAIR = dict(x0=-75.6, x1=-72.4, front=421.6, top=420.1, door=418.7, z0=.22, rise=.24, n=5)
WALK_Y = 422.3
STREET_SHOT = dict(eye=(-88, 431, 7.5), at=(-58, 422, 1.2), lens=24, shift=0.0, fstop=16)
STREET_IN = [(-360, 380, 60), (-300, 431, 22), (-200, 432, 10)]
STREET_OUT = [(-98, 432, 62), (-160, 310, 125), (-84, -70, 13)]
LOOK_VIA = {7: [(-40, 520, 25), (-90, 520, 40), (-40, 220, 18)]}
AGENTS = []       # 시간 t를 받아 자세를 정하는 함수들
DECISIONS = {}    # 반복 영상 안에서 판단이 일어나는 순간과 자리(페이지의 카드 좌표)
ICE = (.62, .86, 1.0)
LAMP_W = 90


def street_window(f):
    """교차로 소품이 켜지는 정도. 카메라가 내려오며 켜지고, 집으로 돌아가며 꺼진다."""
    return ramp(f, STREET_ON, STREET_ON + 50) * (1 - ramp(f, STREET_OFF - 40, STREET_OFF))


def street_prop(ob, name="lit", peak=1.0):
    frames = sorted({STREET_ON - 1, *range(STREET_ON, LAST + 1, 2), LAST})
    prop(ob, name, [(f, peak * street_window(f)) for f in frames])


def street_only(ob):
    ob.hide_render = True
    bake(ob, "hide_render", [(0, 1), (STREET_ON - 1, 1), (STREET_ON, 0), (STREET_OFF, 1), (LAST, 1)], interp="CONSTANT")
    return ob


def road_material():
    """도시 바닥과 같은 아스팔트. wet가 1이 되면 빗물에 젖어 창과 가로등이 비친다."""
    m = bpy.data.materials.new("wet road")
    N, L = tree_of(m)
    b = N["Principled BSDF"]
    b.inputs["Base Color"].default_value = (.018, .019, .021, 1)
    wet = N.new("ShaderNodeAttribute"); wet.attribute_type = "OBJECT"; wet.attribute_name = "wet"
    tc = N.new("ShaderNodeTexCoord")
    pud = N.new("ShaderNodeTexNoise"); pud.inputs["Scale"].default_value = .09; pud.inputs["Detail"].default_value = 4
    L.new(tc.outputs["Object"], pud.inputs["Vector"])
    pr = N.new("ShaderNodeMapRange"); pr.inputs["From Min"].default_value = .42; pr.inputs["From Max"].default_value = .6
    pr.inputs["To Min"].default_value = .3; pr.inputs["To Max"].default_value = .05
    L.new(pud.outputs["Fac"], pr.inputs["Value"])
    rough = N.new("ShaderNodeMix"); rough.data_type = "FLOAT"
    sock(rough.inputs, "A_Float").default_value = .55
    L.new(wet.outputs["Fac"], sock(rough.inputs, "Factor_Float")); L.new(pr.outputs["Result"], sock(rough.inputs, "B_Float"))
    L.new(sock(rough.outputs, "Result_Float"), b.inputs["Roughness"])
    bp = N.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = .12
    fine = N.new("ShaderNodeTexNoise"); fine.inputs["Scale"].default_value = 3.0; fine.inputs["Detail"].default_value = 8
    L.new(fine.outputs["Fac"], bp.inputs["Height"]); L.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def bar(b, x0, y0, x1, y1, w, z=.012):
    """바닥에 칠한 선. 두 점 사이 폭 w."""
    dx, dy = x1 - x0, y1 - y0; n = math.hypot(dx, dy); nx, ny = -dy / n * w / 2, dx / n * w / 2
    b.quad([(x0 + nx, y0 + ny, z), (x0 - nx, y0 - ny, z), (x1 - nx, y1 - ny, z), (x1 + nx, y1 + ny, z)])


def build_street():
    # 젖은 노면: 도시 전체에 한 장. 가장자리는 블록(높이 .22)에 묻힌다.
    road = Builder(road_material()).quad([(-300, 372, .004), (300, 372, .004), (300, 850, .004), (-300, 850, .004)]).build("street road")
    street_only(road); street_prop(road, "wet")
    # 차선과 횡단보도
    white = principled("road paint", (.32, .32, .31), rough=.55)
    yellow = principled("road paint yellow", (.5, .34, .06), rough=.55)
    wb, yb = Builder(white), Builder(yellow)
    gaps = lambda a, b, holes: [(lo, hi) for lo, hi in zip([a, *[h[1] for h in holes]], [*[h[0] for h in holes], b])]
    ave_holes = [(Y0 + PITCH * (j + .5) - 7, Y0 + PITCH * (j + .5) + 7) for j in range(ROWS - 1)]
    st_holes = [(X0 + PITCH * (i + .5) - 7, X0 + PITCH * (i + .5) + 7) for i in range(COLS - 1)]
    for lo, hi in gaps(Y0 - 23, Y0 + PITCH * (ROWS - 1) + 23, ave_holes):
        for o in (-.13, .13): bar(yb, AVE_X + o, lo + 4, AVE_X + o, hi - 4, .1)
        for o in (-3.6, 3.6): bar(wb, AVE_X + o, lo + 4, AVE_X + o, hi - 4, .12)
    for lo, hi in gaps(X0 - 23, X0 + PITCH * (COLS - 1) + 23, st_holes):
        for o in (-.13, .13): bar(yb, lo + 4, ST_Y + o, hi - 4, ST_Y + o, .1)
        for o in (-3.6, 3.6): bar(wb, lo + 4, ST_Y + o, hi - 4, ST_Y + o, .12)
    # 교차로 네 방향의 횡단보도와 정지선
    for yc in (CURB_S - 2, CURB_N + 2):
        x = CURB_W + .6
        while x < CURB_E - .6:
            bar(wb, x, yc - 1.5, x, yc + 1.5, .45); x += 1.0
    for xc in (CURB_W - 2, CURB_E + 2):
        y = CURB_S + .6
        while y < CURB_N - .6:
            bar(wb, xc - 1.5, y, xc + 1.5, y, .45); y += 1.0
    bar(wb, AVE_X, CURB_S - 4, CURB_E - .4, CURB_S - 4, .4)          # 북행 정지선
    bar(wb, CURB_E + 4, ST_Y, CURB_E + 4, CURB_N - .4, .4)          # 서행 정지선
    for ob in (wb.build("street paint"), yb.build("street paint yellow")):
        street_only(ob)

    # 가로등: 보도 가장자리에서 차도 쪽으로 팔을 뻗는다.
    post_mat = principled("lamp post", (.02, .021, .023), rough=.4, metal=.8)
    head_mat = emissive("lamp head", (1.0, .84, .66), 40.0)
    posts, heads = Builder(post_mat), Builder(head_mat)
    lamps = [((CURB_W - .6, 402), (1, 0)), ((CURB_E + .6, 410), (-1, 0)), ((CURB_W - .6, 452), (1, 0)), ((CURB_E + .6, 452), (-1, 0)),
             ((-100, CURB_S - .6), (0, 1)), ((-112, CURB_N + .6), (0, -1)), ((-40, CURB_S - .6), (0, 1)), ((-38, CURB_N + .6), (0, -1)),
             ((-12, CURB_S - .6), (0, 1)), ((-14, CURB_N + .6), (0, -1)), ((-150, CURB_S - .6), (0, 1)), ((-160, CURB_N + .6), (0, -1)),
             ((CURB_W - .6, 476), (1, 0)), ((CURB_E + .6, 500), (-1, 0))]
    for (x, y), (dx, dy) in lamps:
        r, h, arm = .09, 7.6, 1.9
        posts.box(x - r, x + r, y - r, y + r, .22, h)
        hx, hy = x + dx * arm, y + dy * arm
        posts.box(min(x, hx) - .05, max(x, hx) + .05, min(y, hy) - .05, max(y, hy) + .05, h - .12, h)
        heads.box(hx - .32, hx + .32, hy - .14, hy + .14, h - .2, h - .12)
        ld = bpy.data.lights.new(f"street lamp {x:.0f},{y:.0f}", "AREA"); ld.shape = "DISK"; ld.size = .45
        ld.color = (1.0, .84, .66); ld.energy = 0.0
        lo = put(bpy.data.objects.new(ld.name, ld)); lo.location = (hx, hy, h - .22)
        frames = sorted({STREET_ON - 1, *range(STREET_ON, LAST + 1, 2), LAST})
        bake(ld, "energy", [(f, LAMP_W * street_window(f)) for f in frames])
        street_only(lo)
    ph = heads.build("street lamp heads"); street_only(ph); street_prop(ph)
    street_only(posts.build("street lamp posts", bevel=.02))

    # 계단과 문: 로봇이 오를지 정하는 자리
    s = STAIR
    stone = textured("stair stone", (.2, .2, .2), (.3, .3, .29), rough=.6, scale=2.0, bump=.05)
    st = Builder(stone)
    run = (s["front"] - s["top"]) / s["n"]
    for k in range(s["n"]):
        y_front = s["front"] - k * run
        st.box(s["x0"], s["x1"], s["door"], y_front, s["z0"], s["z0"] + s["rise"] * (k + 1))
    street_only(st.build("street stairs", bevel=.01))
    # 양옆 난간: 가는 금속 띠 아래로 빛이 흐른다
    top_z = s["z0"] + s["rise"] * s["n"]
    rail, rail_led = Builder(principled("rail", (.02, .02, .022), rough=.3, metal=.9)), Builder(emissive("rail led", (1.0, .8, .58), 5.0))
    for x in (s["x0"] + .06, s["x1"] - .06):
        for yy, zz in ((s["front"], s["z0"]), (s["top"], top_z)):
            rail.box(x - .025, x + .025, yy - .025, yy + .025, zz, zz + .95)
        n = 12
        for i in range(n):
            y0, y1 = s["front"] + (s["top"] - s["front"]) * i / n, s["front"] + (s["top"] - s["front"]) * (i + 1) / n
            z0 = s["z0"] + .95 + (top_z - s["z0"]) * i / n
            rail.box(x - .03, x + .03, min(y0, y1), max(y0, y1), z0, z0 + .05)
            rail_led.box(x - .02, x + .02, min(y0, y1), max(y0, y1), z0 - .02, z0)
        rail.box(x - .03, x + .03, s["door"] + .2, s["top"], top_z + .95, top_z + 1.0)
    street_only(rail.build("street rail")); rl = rail_led.build("street rail led"); street_only(rl); street_prop(rl)
    glow = Builder(emissive("stair nosing", (1.0, .8, .58), 6.0))
    for k in range(s["n"]):
        y_front = s["front"] - k * run
        z = s["z0"] + s["rise"] * (k + 1)
        glow.box(s["x0"] + .05, s["x1"] - .05, y_front - .03, y_front - .01, z - .05, z - .02)
    g = glow.build("street stair lights"); street_only(g); street_prop(g)
    door = Builder(emissive("door glow", (1.0, .78, .52), 2.2)).box(s["x0"] + .3, s["x1"] - .3, s["door"] - .02, s["door"] + .01, s["z0"] + s["rise"] * s["n"], 3.9).build("street door")
    street_only(door); street_prop(door)
    build_shopfronts()
    canopy = Builder(principled("canopy", (.03, .03, .032), rough=.35, metal=.6)).box(s["x0"] - .5, s["x1"] + .5, s["door"], s["top"] + .4, 4.0, 4.18).build("street canopy")
    street_only(canopy)
    build_agents()


def shop_material():
    """가게 유리 안쪽의 빛. 가게마다(메시 조각마다) 색과 밝기가 다르고, 천장 쪽이 밝고, 안쪽 진열이 얼룩진다."""
    m = bpy.data.materials.new("shop glow")
    N, L = tree_of(m); N.clear()
    out = N.new("ShaderNodeOutputMaterial"); em = N.new("ShaderNodeEmission")
    geo = N.new("ShaderNodeNewGeometry"); tc = N.new("ShaderNodeTexCoord"); sep = N.new("ShaderNodeSeparateXYZ")
    L.new(tc.outputs["Object"], sep.inputs[0])
    lit = N.new("ShaderNodeAttribute"); lit.attribute_type = "OBJECT"; lit.attribute_name = "lit"

    def M(op, a, c):
        n = N.new("ShaderNodeMath"); n.operation = op
        for k, v in enumerate((a, c)):
            if isinstance(v, (int, float)): n.inputs[k].default_value = v
            else: L.new(v, n.inputs[k])
        return n.outputs[0]
    rnd = geo.outputs["Random Per Island"]
    ramp_c = N.new("ShaderNodeValToRGB"); ramp_c.color_ramp.interpolation = "CONSTANT"
    ramp_c.color_ramp.elements[0].color = (1.0, .6, .3, 1); ramp_c.color_ramp.elements[1].position = .55; ramp_c.color_ramp.elements[1].color = (1.0, .8, .58, 1)
    e = ramp_c.color_ramp.elements.new(.82); e.color = (.72, .86, 1.0, 1)
    L.new(rnd, ramp_c.inputs["Fac"]); L.new(ramp_c.outputs["Color"], em.inputs["Color"])
    top = M("ADD", .35, M("MULTIPLY", M("DIVIDE", M("SUBTRACT", sep.outputs["Z"], .45), 3.0), .65))
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 1.6; nz.inputs["Detail"].default_value = 3
    L.new(tc.outputs["Object"], nz.inputs["Vector"])
    blot = M("ADD", .45, M("MULTIPLY", nz.outputs["Fac"], .9))
    strength = M("MULTIPLY", M("MULTIPLY", M("MULTIPLY", top, blot), M("ADD", .25, M("MULTIPLY", rnd, .9))), M("MULTIPLY", lit.outputs["Fac"], .75))
    L.new(strength, em.inputs["Strength"]); L.new(em.outputs[0], out.inputs["Surface"])
    no_emission_sampling(m)
    return m


def build_shopfronts():
    """교차로 가까운 건물의 1층 가게 불빛. 길 쪽 면에만, 칸마다 켜짐과 색을 조금씩 다르게."""
    S.frame_set(STREET)   # 건물 크기는 키프레임으로만 있으므로 한 번 평가한다
    r = random.Random(11)
    warm = cool = Builder(shop_material())
    frame = Builder(principled("shop frame", (.02, .02, .022), rough=.4, metal=.6))
    for o in [o for o in S.objects if o.name.startswith("bldg")]:
        x, y = o.location.x, o.location.y; w, d = o.scale.x, o.scale.y
        if not (-180 < x < 70 and 377 < y < 560): continue
        i, j = round((x - X0) / PITCH), round((y - Y0) / PITCH)
        cx, cy = X0 + i * PITCH, Y0 + j * PITCH
        faces = [("x", x - w / 2, y - d / 2, y + d / 2, -1, (x - w / 2) - (cx - BLOCK / 2)), ("x", x + w / 2, y - d / 2, y + d / 2, 1, (cx + BLOCK / 2) - (x + w / 2)),
                 ("y", y - d / 2, x - w / 2, x + w / 2, -1, (y - d / 2) - (cy - BLOCK / 2)), ("y", y + d / 2, x - w / 2, x + w / 2, 1, (cy + BLOCK / 2) - (y + d / 2))]
        eye = Vector(STREET_SHOT["eye"])
        for axis, at, lo, hi, sgn, gap in faces:
            if gap > 4.5: continue
            mid = Vector((at, (lo + hi) / 2, 2)) if axis == "x" else Vector(((lo + hi) / 2, at, 2))
            if (mid - eye).length < 26: continue   # 카메라 코앞의 면은 화면을 덮으므로 비운다
            u = lo + .6
            while u < hi - 1.5:
                seg = min(hi - .6, u + r.uniform(3.5, 8.0))
                if r.random() < .72:
                    b = warm if r.random() < .62 else cool
                    z0, z1, t0 = .45, r.uniform(2.9, 3.4), at + sgn * .02
                    m0, m1 = min(at, at + sgn * .08), max(at, at + sgn * .08)
                    if axis == "x":
                        b.box(min(t0, t0 + sgn * .04), max(t0, t0 + sgn * .04), u, seg, z0, z1)
                        frame.box(min(at, at + sgn * .5), max(at, at + sgn * .5), u - .1, seg + .1, z1 + .05, z1 + .3)
                        for mu in [u + k * 1.3 for k in range(1, int((seg - u) / 1.3))]:
                            frame.box(m0, m1, mu - .04, mu + .04, z0, z1)
                    else:
                        b.box(u, seg, min(t0, t0 + sgn * .04), max(t0, t0 + sgn * .04), z0, z1)
                        frame.box(u - .1, seg + .1, min(at, at + sgn * .5), max(at, at + sgn * .5), z1 + .05, z1 + .3)
                        for mu in [u + k * 1.3 for k in range(1, int((seg - u) / 1.3))]:
                            frame.box(mu - .04, mu + .04, m0, m1, z0, z1)
                u = seg + r.uniform(.4, 1.6)
    ob = warm.build("street shops")
    street_only(ob); street_prop(ob)
    street_only(frame.build("street shop awnings"))


# ── 움직이는 것들 ────────────────────────────────────────────────────
class Route:
    """평면 꺾은선. 모서리마다 반지름 r의 원호로 깎는다. s(앞에서부터 거리) → 위치와 방향."""
    def __init__(self, pts, r=0.0):
        P = [Vector(p) for p in pts]
        out = [P[0]]
        for a, b, c in zip(P, P[1:], P[2:]):
            d1, d2 = (b - a).normalized(), (c - b).normalized()
            turn = math.atan2(d1.x * d2.y - d1.y * d2.x, d1.dot(d2))
            if r <= 0 or abs(turn) < 1e-3:
                out.append(b); continue
            k = r * math.tan(abs(turn) / 2)
            p0 = b - d1 * k
            n = Vector((-d1.y, d1.x)) * (1 if turn > 0 else -1)
            ctr = p0 + n * r
            a0 = math.atan2(p0.y - ctr.y, p0.x - ctr.x)
            steps = max(6, int(abs(turn) / .05))
            for i in range(steps + 1):
                ang = a0 + turn * i / steps
                out.append(ctr + Vector((math.cos(ang), math.sin(ang))) * r)
        out.append(P[-1])
        self.p = out
        self.cum = [0.0]
        for a, b in zip(out, out[1:]):
            self.cum.append(self.cum[-1] + (b - a).length)
        self.length = self.cum[-1]

    def at(self, s):
        s = max(0.0, min(self.length - 1e-6, s))
        i = min(bisect(self.cum, s) - 1, len(self.p) - 2)
        a, b = self.p[i], self.p[i + 1]
        seg = self.cum[i + 1] - self.cum[i]
        pos = a.lerp(b, (s - self.cum[i]) / seg if seg > 0 else 0)
        # 방향은 조금 앞뒤를 보고 정해 원호에서도 매끄럽게
        j, k = max(0, i - 1), min(len(self.p) - 1, i + 2)
        d = self.p[k] - self.p[j]
        return pos, math.atan2(d.y, d.x)


def timeline(keys):
    """[(τ, s)]를 단조 3차 보간한다(Fritsch–Carlson). 같은 s가 이어지면 그 사이는 멈춰 있다."""
    T, V = [k[0] for k in keys], [k[1] for k in keys]
    n = len(keys)
    d = [(V[i + 1] - V[i]) / (T[i + 1] - T[i]) for i in range(n - 1)]
    m = [d[0], *[0.0 if d[i - 1] * d[i] <= 0 else (d[i - 1] + d[i]) / 2 for i in range(1, n - 1)], d[-1]]
    for i in range(n - 1):
        if d[i] == 0:
            m[i] = m[i + 1] = 0.0
    for i in range(n - 1):
        if d[i] == 0: continue
        a, b = m[i] / d[i], m[i + 1] / d[i]
        h = a * a + b * b
        if h > 9:
            t = 3 / math.sqrt(h); m[i], m[i + 1] = t * a * d[i], t * b * d[i]

    def s(t):
        if t <= T[0]: return V[0]
        if t >= T[-1]: return V[-1]
        i = bisect(T, t) - 1
        h = T[i + 1] - T[i]; u = (t - T[i]) / h
        h00, h10, h01, h11 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u, -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2
        return h00 * V[i] + h10 * h * m[i] + h01 * V[i + 1] + h11 * h * m[i + 1]
    return s


def emissive_attr(name, color, strength, attr):
    return emissive(name, color, strength, attr=attr)


CAR_GLASS = principled("car glass", (.012, .016, .02), rough=.06, spec=.8)
CAR_TRIM = principled("car trim", (.015, .015, .016), rough=.5)
CAR_TIRE = principled("tire", (.01, .01, .01), rough=.85)
SENSOR = principled("roof sensor", (.03, .032, .036), rough=.25, metal=.4)


def car_paint(name, color):
    m = principled(name, color, rough=.22)
    b = m.node_tree.nodes["Principled BSDF"]
    try: b.inputs["Coat Weight"].default_value = .6
    except Exception: pass
    return m


def wheel_mesh():
    v, f, seg, r, w = [], [], 18, .34, .24
    for i in range(seg):
        a = math.tau * i / seg
        v += [(r * math.cos(a), -w / 2, r * math.sin(a) + r), (r * math.cos(a), w / 2, r * math.sin(a) + r)]
    for i in range(seg):
        j = (i + 1) % seg; f.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    f.append(tuple(2 * i for i in range(seg))); f.append(tuple(2 * i + 1 for i in reversed(range(seg))))
    me = bpy.data.meshes.new("wheel"); me.from_pydata(v, [], f); me.update(); me.materials.append(CAR_TIRE)
    for p in me.polygons: p.use_smooth = True
    return me


WHEEL = None


def child(parent, ob, loc=(0, 0, 0)):
    ob.parent = parent
    ob.location = loc
    return ob


def make_car(name, paint, hero=False):
    """자율주행 택시. +x가 앞. 지붕의 센서 고리가 판단할 때 밝아진다."""
    global WHEEL
    WHEEL = WHEEL or wheel_mesh()
    root = put(bpy.data.objects.new(f"street · {name}", None))
    parts = []
    body = (Builder(paint, CAR_TRIM)
            .box(-2.3, 2.3, -.93, .93, .3, .86, 0)
            .box(-2.32, 2.32, -.94, .94, .3, .44, 1)
            .build(f"street · {name} body", bevel=.14))
    cabin = Builder(CAR_GLASS, paint).box(-1.45, 1.0, -.82, .82, .86, 1.4, 0).box(-1.2, .8, -.72, .72, 1.4, 1.46, 1).build(f"street · {name} cabin", bevel=.1)
    sensor = cylinder(f"street · {name} sensor", -.2, 0, 1.44, 1.66, .26, SENSOR, seg=20)
    ring = cylinder(f"street · {name} ring", -.2, 0, 1.53, 1.57, .265, emissive(f"{name} ring", ICE, 3.0, attr="flash"), seg=20)
    head = Builder(emissive(f"{name} head", (1.0, .94, .86), 26.0)).box(2.27, 2.33, -.86, -.5, .66, .74).box(2.27, 2.33, .5, .86, .66, .74).box(2.29, 2.33, -.5, .5, .7, .72).build(f"street · {name} head")
    tail = Builder(emissive(f"{name} tail", (1.0, .05, .03), 5.0, attr="brake")).box(-2.33, -2.27, -.9, .9, .76, .82).build(f"street · {name} tail")
    blink = Builder(emissive(f"{name} blink", (1.0, .45, .05), 14.0, attr="blink")).box(2.25, 2.31, -.93, -.84, .64, .74).box(-2.33, -2.27, -.93, -.84, .7, .8).build(f"street · {name} blink")
    head["lit"] = 1.0
    for ob in (body, cabin, sensor, ring, head, tail, blink):
        parts.append(child(root, ob))
    for x in (1.45, -1.45):
        for y in (.83, -.83):
            parts.append(child(root, put(bpy.data.objects.new(f"street · {name} wheel", WHEEL)), (x, y, 0)))
    for y in (.68, -.68):
        ld = bpy.data.lights.new(f"street · {name} beam", "SPOT"); ld.energy = 220 if hero else 140
        ld.spot_size = math.radians(70); ld.spot_blend = .5; ld.color = (1.0, .93, .82); ld.shadow_soft_size = .05
        lo = put(bpy.data.objects.new(ld.name, ld)); lo.rotation_euler = (0, math.radians(-82), 0)
        parts.append(child(root, lo, (2.4, y, .72)))
    return root, parts, dict(ring=ring, tail=tail, blink=blink)


ROBOT_SHELL = principled("robot shell", (.62, .64, .66), rough=.35, metal=.1)
ROBOT_DARK = principled("robot joints", (.025, .026, .03), rough=.4, metal=.5)
L1, L2, HIP_H = .27, .28, .485


def make_robot(name, scale=1.45):
    """사족 로봇. +x가 앞. 몸 옆의 띠와 눈이 판단할 때 밝아진다."""
    root = put(bpy.data.objects.new(f"street · {name}", None))
    root.scale = (scale,) * 3
    parts, legs = [], []
    body = Builder(ROBOT_SHELL, ROBOT_DARK).box(-.42, .42, -.16, .16, -.1, .12, 0).box(-.38, .38, -.12, .12, -.14, -.1, 1).box(.42, .56, -.11, .11, -.06, .08, 1).build(f"street · {name} body", bevel=.03)
    eyes = Builder(emissive(f"{name} eyes", ICE, 6.0, attr="flash")).box(.555, .565, -.08, .08, .0, .03).box(-.3, .3, .161, .166, .02, .05).box(-.3, .3, -.166, -.161, .02, .05).build(f"street · {name} eyes")
    torso_z = HIP_H + .03 + .04
    parts += [child(root, body, (0, 0, torso_z)), child(root, eyes, (0, 0, torso_z))]
    thigh_me = Builder(ROBOT_DARK).box(-.045, .045, -.04, .04, -L1, .03).build(f"{name} thigh").data
    shin_me = Builder(ROBOT_SHELL).box(-.032, .032, -.03, .03, -L2, .0).box(-.045, .045, -.045, .045, -L2 - .03, -L2 + .03).build(f"{name} shin").data
    for o in [o for o in bpy.data.objects if o.data in (thigh_me, shin_me) and o.name.startswith(name)]:
        bpy.data.objects.remove(o)
    for k, (hx, hy) in enumerate(((.32, .2), (.32, -.2), (-.32, .2), (-.32, -.2))):
        hip = child(root, put(bpy.data.objects.new(f"street · {name} hip {k}", None)), (hx, hy, torso_z - .04))
        thigh = child(hip, put(bpy.data.objects.new(f"street · {name} thigh {k}", thigh_me)))
        knee = child(hip, put(bpy.data.objects.new(f"street · {name} knee {k}", None)), (0, 0, -L1))
        shin = child(knee, put(bpy.data.objects.new(f"street · {name} shin {k}", shin_me)))
        parts += [hip, thigh, knee, shin]
        legs.append((hip, knee, 0.0 if k in (0, 3) else math.pi))
    ld = bpy.data.lights.new(f"street · {name} lamp", "SPOT"); ld.energy = 12; ld.spot_size = math.radians(60); ld.color = (.75, .9, 1.0); ld.shadow_soft_size = .02
    lo = put(bpy.data.objects.new(ld.name, ld)); lo.rotation_euler = (0, math.radians(-75), 0)
    parts.append(child(root, lo, (.6, 0, torso_z)))
    return root, parts, dict(eyes=eyes, legs=legs)


def leg_ik(x, z):
    """엉덩이에서 발까지 (x 앞, z 위). 무릎이 뒤로 접히는 두 마디. 허벅지 각과 정강이 상대 각."""
    D = min(L1 + L2 - 1e-3, math.hypot(x, z))
    th = math.atan2(-x, -z)
    al = math.acos(max(-1, min(1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D))))
    be = math.acos(max(-1, min(1, (L2 * L2 + D * D - L1 * L1) / (2 * L2 * D))))
    a, c = th + al, th - be
    return a, c - a


def make_beam(name):
    """판단 하나 = 빛 한 줄기(도식). head가 오르는 높이, on이 밝기."""
    m = bpy.data.materials.new(f"{name} light")
    N, L = tree_of(m); N.clear()
    out = N.new("ShaderNodeOutputMaterial"); em = N.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (*ICE, 1)
    tr = N.new("ShaderNodeBsdfTransparent"); add = N.new("ShaderNodeAddShader")
    tc = N.new("ShaderNodeTexCoord"); sep = N.new("ShaderNodeSeparateXYZ"); L.new(tc.outputs["Object"], sep.inputs[0])

    def attr(n):
        a = N.new("ShaderNodeAttribute"); a.attribute_type = "OBJECT"; a.attribute_name = n
        return a.outputs["Fac"]

    def M(op, a, c, clamp=False):
        n = N.new("ShaderNodeMath"); n.operation = op; n.use_clamp = clamp
        for k, v in enumerate((a, c)):
            if isinstance(v, (int, float)): n.inputs[k].default_value = v
            else: L.new(v, n.inputs[k])
        return n.outputs[0]
    head, on = attr("head"), attr("on")
    dz = M("SUBTRACT", head, sep.outputs["Z"])
    tail = M("SUBTRACT", 1.0, M("DIVIDE", dz, 9.0), clamp=True)
    below = M("GREATER_THAN", dz, 0.0)
    val = M("MULTIPLY", M("MULTIPLY", M("MULTIPLY", tail, tail), below), M("MULTIPLY", on, 60.0))
    L.new(val, em.inputs["Strength"])
    L.new(tr.outputs[0], add.inputs[0]); L.new(em.outputs[0], add.inputs[1]); L.new(add.outputs[0], out.inputs["Surface"])
    no_emission_sampling(m)
    ob = cylinder(f"street · {name}", 0, 0, 0, 40, .05, m, seg=8)
    ob.visible_shadow = False; ob.visible_diffuse = False
    ob["head"] = 0.0; ob["on"] = 0.0
    return ob


def pulse_at(tau, t_dec, rise=24.0):
    """판단 순간부터 빛이 오르는 높이와 밝기."""
    u = tau - t_dec
    if u < 0 or u > 40: return 0.0, 0.0
    return min(42.0, u * rise / 12 * 1.4), (1 - ramp(u, 18, 40)) if u > 18 else 1.0


def flash_at(tau, t_dec, base):
    u = tau - t_dec
    return base + (6.0 * math.exp(-max(0, u) / 10) if u >= -2 else 0) if u < 60 else base


def build_agents():
    """자율주행차(우회전), 마주 오는 차, 사족 로봇(계단). 복제본을 주기의 몫만큼 어긋나게 둔다."""
    # 주인공 차: 남쪽에서 북행 차선으로 올라와 정지선에 서고, 판단한 뒤 동쪽으로 우회전해 협곡으로 간다.
    hero_route = Route([(NB, 380), (NB, EB), (-1.75, EB), (-1.75, 360)], r=5.5)
    stop_s = (CURB_S - 4 - .25 - 2.33) - 380
    hero_tl = timeline([(0, 0), (40, 13.2), (80, 25.5), (110, 32.0), (130, stop_s - .25), (145, stop_s), (230, stop_s),
                        (255, stop_s + 1.0), (280, stop_s + 4.0), (310, stop_s + 11), (340, stop_s + 21), (370, stop_s + 33),
                        (400, stop_s + 47), (430, stop_s + 62), (455, stop_s + 75), (479, stop_s + 88)])
    HERO_DEC, HERO_Q = 165, 2 * LOOP
    hero_hidden = lambda tau: hero_route.at(hero_tl(tau))[0].y < 416.5 and tau > 300
    for c in range(2):
        root, parts, lights = make_car(f"robotaxi {c}", car_paint(f"robotaxi paint {c}", (.78, .79, .8)), hero=True)
        beam = make_beam(f"car decision {c}")
        off = c * LOOP

        def apply(t, root=root, parts=parts, lights=lights, beam=beam, off=off):
            tau = (t + off) % HERO_Q
            s = hero_tl(tau); pos, yaw = hero_route.at(s)
            v = hero_tl(tau + 1) - hero_tl(tau - 1)
            root.location = (pos.x, pos.y, .0); root.rotation_euler = (0, 0, yaw)
            hidden = hero_hidden(tau)
            for p in parts: p.hide_render = hidden
            lights["tail"]["brake"] = 1.0 if v < .02 or (hero_tl(tau + 3) - hero_tl(tau)) < (hero_tl(tau) - hero_tl(tau - 3)) - .02 else .35
            lights["blink"]["blink"] = 1.0 if 130 <= tau <= 300 and int(tau / 12) % 2 == 0 else 0.0
            lights["ring"]["flash"] = flash_at(tau, HERO_DEC, 1.0)
            h, on = pulse_at(tau, HERO_DEC)
            beam.location = (pos.x - .2 * math.cos(yaw), pos.y - .2 * math.sin(yaw), 1.66)
            beam["head"], beam["on"] = h, on
            beam.hide_render = on <= 0
            return [root, *parts, beam]
        AGENTS.append(apply)
    p, _ = hero_route.at(stop_s)
    DECISIONS["car"] = dict(t=HERO_DEC % LOOP, at=(p.x, p.y, 2.2))

    # 마주 오는 차들: 북쪽 대로를 따라 남행. 주기마다 88 m(11 m/s × 8 s) 간격.
    south = Route([(SB, 556), (SB, 380)])
    v = 88.0 / LOOP
    for c in range(2):
        root, parts, lights = make_car(f"southbound {c}", car_paint(f"car paint s{c}", ((.05, .055, .06), (.32, .33, .35))[c]))

        def apply(t, root=root, parts=parts, lights=lights, c=c):
            s = (t * v + c * 88.0) % south.length
            pos, yaw = south.at(s)
            root.location = (pos.x, pos.y, 0); root.rotation_euler = (0, 0, yaw)
            for p in parts: p.hide_render = False
            lights["tail"]["brake"] = .35; lights["blink"]["blink"] = 0.0; lights["ring"]["flash"] = .6
            return [root, *parts]
        AGENTS.append(apply)
    # 서행: x=0 대로에서 좌회전해 들어와 카메라 아래로 지나간다.
    west = Route([(1.75, 380), (1.75, WB), (-140, WB)], r=6.0)
    for c in range(2):
        root, parts, lights = make_car(f"westbound {c}", car_paint(f"car paint w{c}", ((.16, .17, .19), (.6, .6, .62))[c]))

        def apply(t, root=root, parts=parts, lights=lights, c=c):
            s = (t * v + c * 88.0 + 30) % 176.0
            pos, yaw = west.at(s)
            root.location = (pos.x, pos.y, 0); root.rotation_euler = (0, 0, yaw)
            for p in parts: p.hide_render = False
            lights["tail"]["brake"] = .35; lights["blink"]["blink"] = 0.0; lights["ring"]["flash"] = .6
            return [root, *parts]
        AGENTS.append(apply)

    # 사족 로봇: 북쪽 보도를 따라 동쪽으로 오다 계단 앞에서 남쪽으로 돌아 서고, 판단한 뒤 올라 문으로 들어간다.
    s = STAIR
    cx = (s["x0"] + s["x1"]) / 2
    walk = timeline([(0, -90.0), (30, -88.6), (200, -78.4), (235, cx - .05), (250, cx)])
    TURN0, TURN1, ROB_DEC, CLIMB0, CLIMB1, DOOR1 = 250, 285, 300, 335, 420, 470
    climb = timeline([(CLIMB0, WALK_Y), (CLIMB0 + 12, WALK_Y - .15), (CLIMB1, s["top"] - .2), (DOOR1, s["door"] - 1.3)])
    ROB_Q = 2 * LOOP
    stair_z = lambda y: s["z0"] + max(0.0, min(s["n"] * s["rise"], (s["front"] - y) / (s["front"] - s["top"]) * s["n"] * s["rise"]))
    for c in range(2):
        root, parts, bits = make_robot(f"quadruped {c}")
        beam = make_beam(f"robot decision {c}")
        off = c * LOOP

        def apply(t, root=root, parts=parts, bits=bits, beam=beam, off=off):
            tau = (t + off) % ROB_Q
            sc = root.scale[0]
            if tau < TURN0:
                x, y, yaw = walk(tau), WALK_Y, 0.0
                dist = walk(tau) + 90.0
            elif tau < CLIMB0:
                x, y = cx, WALK_Y
                yaw = -math.pi / 2 * ease_io((tau - TURN0) / (TURN1 - TURN0))
                dist = (walk(TURN0) + 90.0) + abs(yaw) * .35
            else:
                x, y, yaw = cx, climb(tau), -math.pi / 2
                dist = (walk(TURN0) + 90.0) + math.pi / 2 * .35 + (WALK_Y - y)
            # 계단 위에서는 몸 앞뒤의 높이 차로 기울기를 정한다.
            half = .42 * sc
            zf, zb = stair_z(y - half), stair_z(y + half)
            z = (zf + zb) / 2 - s["z0"]
            pitch = -math.atan2(zf - zb, 2 * half) * .7
            root.location = (x, y, s["z0"] + z)
            root.rotation_euler = (0, pitch, yaw)
            moving = abs((walk(tau + 1) - walk(tau - 1)) if tau < TURN0 else (climb(tau + 1) - climb(tau - 1)) if tau >= CLIMB0 else (TURN0 < tau < TURN1))
            stride = .52 * sc
            on_stairs = CLIMB0 <= tau < CLIMB1 + 10
            for hip, knee, ph in bits["legs"]:
                phi = math.tau * dist / stride + ph
                amp = min(1.0, moving * 12) if not isinstance(moving, bool) else (1.0 if moving else 0.0)
                u = .12 * math.sin(phi) * amp
                lift = (.07 + (.1 if on_stairs else 0)) * max(0.0, math.cos(phi)) * amp
                a, b = leg_ik(u, -(HIP_H - lift))
                hip.rotation_euler = (0, a, 0); knee.rotation_euler = (0, b, 0)
            hidden = tau >= DOOR1 - 4
            for p in parts: p.hide_render = hidden
            bits["eyes"]["flash"] = flash_at(tau, ROB_DEC, 1.0)
            h, on = pulse_at(tau, ROB_DEC)
            beam.location = (x, y, s["z0"] + z + 1.0)
            beam["head"], beam["on"] = h, on
            beam.hide_render = on <= 0
            return [root, *parts, beam]
        AGENTS.append(apply)
    DECISIONS["robot"] = dict(t=ROB_DEC % LOOP, at=(cx, WALK_Y, 1.6))
    for ob in bpy.data.objects:
        if ob.name.startswith("street · "):
            ob.cycles.use_motion_blur = False


def apply_agents(t):
    obs = []
    for fn in AGENTS: obs += fn(t)
    return obs


def bake_agents():
    """필름 구간에서는 프레임마다 자세를 굽는다. STREET_ON 앞과 STREET_OFF 뒤에서는 숨긴다."""
    rec = {}
    for f in range(STREET_ON - 1, LAST + 1):
        hide = f < STREET_ON or f >= STREET_OFF
        for ob in apply_agents(f - STREET):
            if hide: ob.hide_render = True
            for path in ("location", "rotation_euler"):
                for i, v in enumerate(getattr(ob, path)):
                    rec.setdefault((ob, path, i), []).append((f, v))
            rec.setdefault((ob, "hide_render", 0), []).append((f, float(ob.hide_render)))
            for key in ("brake", "blink", "flash", "head", "on"):
                if key in ob.keys(): rec.setdefault((ob, f'["{key}"]', 0), []).append((f, ob[key]))
    for (ob, path, i), samples in rec.items():
        if len({round(v, 6) for _, v in samples}) == 1 and path != "hide_render":
            continue   # 움직이지 않는 값은 굽지 않는다
        bake(ob, path, samples, index=i, interp="CONSTANT" if path == "hide_render" else "LINEAR")


# ── 하늘 ─────────────────────────────────────────────────────────────
def build_world():
    w = bpy.data.worlds.new("dusk"); S.world = w
    w.use_nodes = True
    N, L = w.node_tree.nodes, w.node_tree.links
    bg = N["Background"]
    sky = N.new("ShaderNodeTexSky"); sky.name = "Sky"
    sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_disc = False
    sky.altitude = 120
    sky.air_density, sky.aerosol_density = 1.0, 1.6
    sky.sun_rotation = math.radians(292)
    # 밤이 깊어지면 별을 조금
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
    frames = sorted({*range(0, LAST + 1, 6), LAST})
    elev = split([(0, -.9), (252, -2.2), (342, -3.6), (420, -5.2), (480, -6.4), (OLD_LAST, -6.8)], [(LAST, -6.8)])
    strength = split([(0, 1.0), (252, 1.0), (420, 1.25), (OLD_LAST, 1.35)], [(LAST, 1.35)])
    starsv = split([(0, 0), (300, 0), (420, .6), (OLD_LAST, .9)], [(LAST, .9)])
    # 교차로에서는 가까운 창과 가로등이 밝으므로 노출을 조금 내린다.
    expo = split([(0, .95), (168, 1.0), (252, 1.0), (342, 1.25), (420, 1.4), (480, 1.5), (OLD_LAST, 1.35)], [(ANCHORS[7], STREET_EXPOSURE), (LAST, 1.35)])
    bake(w.node_tree, 'nodes["Sky"].sun_elevation', [(f, math.radians(elev(f))) for f in frames])
    bake(w.node_tree, 'nodes["Background"].inputs[1].default_value', [(f, strength(f)) for f in frames])
    bake(w.node_tree, 'nodes["Stars"].outputs[0].default_value', [(f, starsv(f)) for f in frames])
    bake(S, "view_settings.exposure", [(f, expo(f)) for f in frames])


def piece(tbl, f):
    for (f0, v0), (f1, v1) in zip(tbl, tbl[1:]):
        if f0 <= f <= f1: return lerp(v0, v1, ease_io((f - f0) / (f1 - f0)))
    return tbl[-1][1]


def split(old, new):
    """KEEP(480)까지는 예전 표 그대로, 그 뒤는 KEEP의 값에서 새 표로 잇는다. 값은 수 또는 튜플."""
    def mix(tbl, f):
        for (f0, v0), (f1, v1) in zip(tbl, tbl[1:]):
            if f0 <= f <= f1:
                t = ease_io((f - f0) / (f1 - f0))
                return tuple(lerp(a, b, t) for a, b in zip(v0, v1)) if isinstance(v0, tuple) else lerp(v0, v1, t)
        return tbl[-1][1]
    tail = [(KEEP, mix(old, KEEP)), *new]
    return lambda f: mix(old, f) if f <= KEEP else mix(tail, f)


# ── 카메라 ───────────────────────────────────────────────────────────
# 단계마다: 눈, 시선, 렌즈, 가로 이동(글 단이 왼쪽에 오도록 대상은 오른쪽에)
SHOTS = [
    dict(eye=(36, -44, 14), at=(-3, -2, 1.2), lens=27, shift=-.24, fstop=16),
    dict(eye=(31, -42, 11.2), at=(-3.5, -1, 3.0), lens=27, shift=-.24, fstop=16),
    dict(eye=(30, -44, 10.2), at=(-1.5, -.5, 4.4), lens=26, shift=-.21, fstop=16),
    dict(eye=(30, -32.5, 3.9), at=(-3.5, -2.5, 4.6), lens=23, shift=-.075, fstop=16),
    dict(eye=(150, 120, 190), at=(0, 560, 30), lens=27, shift=-.1, fstop=22),
    dict(eye=(-390, -130, 920), at=(-30, 615, 0), lens=27, shift=-.19, fstop=22),
    dict(eye=(-520, 120, 190), at=(-160, 700, 40), lens=26, shift=-.16, fstop=22),
    STREET_SHOT,
    dict(eye=(-12, -40, 1.9), at=(1, 0, 7.5), lens=26, shift=-.14, fstop=11),
]
# 전환 사이에 거쳐 가는 점(부드러운 궤적을 위해)
VIA = {
    3: [(40, -60, 40), (110, 20, 140)],
    4: [(-80, 40, 520)],
    5: [(-470, 0, 560)],
    6: STREET_IN,
    7: STREET_OUT,
}
for k, v in (json.loads(A.shots) if A.shots else {}).items():
    SHOTS[int(k)].update(v)
SHAKE = []  # (frame, amplitude): 무거운 부품이 내려앉을 때 아주 약하게


def camera_curve():
    """ANCHORS 사이마다: 경로를 Catmull-Rom으로 잇고, 시간은 ease로 감아 정지점에서 속도 0."""
    segs = []
    for k in range(len(ANCHORS) - 1):
        a, b = SHOTS[k], SHOTS[k + 1]
        pts = [Vector(a["eye"]), *[Vector(v) for v in VIA.get(k, [])], Vector(b["eye"])]
        segs.append(pts)

    def eye_at(k, s, pts=None):
        pts = pts or segs[k]
        n = len(pts) - 1
        x = s * n; i = min(int(x), n - 1); t = x - i
        p0 = pts[i - 1] if i > 0 else pts[i] * 2 - pts[i + 1]
        p3 = pts[i + 2] if i + 2 <= n else pts[i + 1] * 2 - pts[i]
        return catmull(p0, pts[i], pts[i + 1], p3, t)

    def at(f):
        f = max(0, min(LAST, f))
        for k in range(len(ANCHORS) - 1):
            f0, f1 = ANCHORS[k], ANCHORS[k + 1]
            if f0 <= f <= f1:
                s = ease_io((f - f0) / (f1 - f0))
                eye = eye_at(k, s)
                a, b = SHOTS[k], SHOTS[k + 1]
                if k in LOOK_VIA:   # 시선도 거쳐 가는 점을 따라 돈다(교차로에서 집으로 물러날 때 계속 북쪽을 보도록)
                    look = eye_at(k, s, [Vector(a["at"]), *[Vector(v) for v in LOOK_VIA[k]], Vector(b["at"])])
                else:
                    look = Vector(a["at"]).lerp(Vector(b["at"]), s)
                lens = lerp(a["lens"], b["lens"], s)
                shift = lerp(a["shift"], b["shift"], s)
                fstop = math.exp(lerp(math.log(a["fstop"]), math.log(b["fstop"]), s))
                return eye, look, lens, shift, fstop
        s = SHOTS[-1]
        return Vector(s["eye"]), Vector(s["at"]), s["lens"], s["shift"], s["fstop"]
    return at


def build_camera():
    cd = bpy.data.cameras.new("camera"); cd.sensor_width = 36
    cam = put(bpy.data.objects.new("camera", cd)); S.camera = cam
    cd.clip_start, cd.clip_end = .5, 12000
    cd.dof.use_dof = True
    at = camera_curve()
    frames = list(range(0, LAST + 1))
    locs, rots, lens, shift, focus, fstop = [], [], [], [], [], []
    prev = None
    for f in frames:
        eye, look, ln, sh, fs = at(f)
        for f0, amp in SHAKE:
            if f0 <= f < f0 + 8:
                d = (f - f0) / 8
                eye = eye + Vector((0, 0, amp * math.sin(d * 22) * (1 - d) ** 2))
        q = (look - eye).to_track_quat("-Z", "Y")
        e = q.to_euler("XYZ", prev) if prev else q.to_euler("XYZ")
        prev = e
        locs.append(eye); rots.append(e); lens.append(ln); shift.append(sh)
        dist = (look - eye).length
        focus.append(dist)
        fstop.append(fs)
    for i in range(3):
        bake(cam, "location", [(f, locs[n][i]) for n, f in enumerate(frames)], index=i)
        bake(cam, "rotation_euler", [(f, rots[n][i]) for n, f in enumerate(frames)], index=i)
    bake(cd, "lens", list(zip(frames, lens)))
    bake(cd, "shift_x", list(zip(frames, shift)))
    bake(cd, "dof.focus_distance", list(zip(frames, focus)))
    bake(cd, "dof.aperture_fstop", list(zip(frames, fstop)))
    return cam


# ── 부품 비행 굽기 ───────────────────────────────────────────────────
PROPS = []
GROW = []


def frustum_clear(part, f, offset):
    """시작 위치에서 부품이 화면 밖에 있는지."""
    S.frame_set(f)
    cam = S.camera
    part.root.location = part.pivot + offset
    bpy.context.view_layer.update()
    for ch in part.children:
        if ch.type != "MESH": continue
        for c in ch.bound_box:
            w = ch.matrix_world @ Vector(c)
            p = world_to_camera_view(S, cam, w)
            if p.z > 0 and -.02 < p.x < 1.02 and -.02 < p.y < 1.02:
                return False
    return True


def bake_parts():
    for part in PARTS:
        f0, f1 = part.frames
        if part.land in ("pop", "grow"):
            continue
        if part.land == "rise":
            dist = .34
            off = part.dir * dist
        else:
            dist = 18.0
            while not frustum_clear(part, f0, part.dir.normalized() * dist) and dist < 400:
                dist *= 1.18
            dist *= 1.08
            off = part.dir.normalized() * dist
        part.root.location = part.pivot

        def pose(f, off=off, part=part):
            t = clamp01((f - f0) / (f1 - f0))
            if part.land == "heavy":
                s = ease_out(t, 3.4)
                bounce = math.exp(-9 * max(0, t - .86) / .14) * math.sin(max(0, t - .86) / .14 * math.pi) * .05 if t > .86 else 0
                pos = part.pivot + off * (1 - s) - Vector((0, 0, bounce))
            elif part.land == "rise":
                s = ease_out(t, 2.2)
                pos = part.pivot + off * (1 - s)
            else:
                s = ease_out(t, 3.0)
                pos = part.pivot + off * (1 - s) + Vector((0, 0, part.arc * math.sin(math.pi * s) * (1 - s)))
            rot = part.spin * (1 - ease_out(t, 2.4))
            return pos, rot
        frames = sorted({0, *span(f0, f1), LAST})
        poses = [pose(f) for f in frames]
        for i in range(3):
            bake(part.root, "location", [(f, p[0][i]) for f, p in zip(frames, poses)], index=i)
            bake(part.root, "rotation_euler", [(f, p[1][i]) for f, p in zip(frames, poses)], index=i)
        for ch in part.children:
            hide_until(ch, f0)
    for part in PARTS:
        if part.land == "pop":
            f0, f1 = part.frames
            fr = sorted({0, *span(f0, f1), LAST})
            back = lambda t: 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2 if t > 0 else 0.0
            for i in range(3):
                bake(part.root, "scale", [(f, max(.001, back(clamp01((f - f0) / (f1 - f0))))) for f in fr], index=i)
            for ch in part.children: hide_until(ch, f0)
    for ob, f0, s in GROW:
        f1 = f0 + 20
        fr = sorted({0, *span(f0, f1), LAST})
        back = lambda t: 1 + 2.0 * (t - 1) ** 3 + 1.0 * (t - 1) ** 2 if t > 0 else 0.0
        for i in range(3):
            bake(ob, "scale", [(f, max(.001, s * back(clamp01((f - f0) / (f1 - f0))))) for f in fr], index=i)
        hide_until(ob, f0)
    for ob, name, samples in PROPS:
        prop(ob, name, samples)


# ── 대기와 마감 ───────────────────────────────────────────────────────
HAZE = split([(0, (.075, .066, .085)), (252, (.05, .05, .07)), (342, (.03, .036, .058)), (420, (.018, .025, .046)), (OLD_LAST, (.014, .02, .04))],
             [(LAST, (.014, .02, .04))])


def add_haze():
    """먼 곳일수록 하늘빛에 묻힌다. 모든 재질의 출력 앞에 같은 그룹을 끼운다."""
    g = bpy.data.node_groups.new("haze", "ShaderNodeTree")
    g.interface.new_socket("Shader", in_out="INPUT", socket_type="NodeSocketShader")
    g.interface.new_socket("Shader", in_out="OUTPUT", socket_type="NodeSocketShader")
    N, L = g.nodes, g.links
    gi, go = N.new("NodeGroupInput"), N.new("NodeGroupOutput")
    cam = N.new("ShaderNodeCameraData")
    k = N.new("ShaderNodeMath"); k.operation = "MULTIPLY"; k.inputs[1].default_value = -1 / 1500; k.name = "HazeK"
    L.new(cam.outputs["View Distance"], k.inputs[0])
    e = N.new("ShaderNodeMath"); e.operation = "EXPONENT"; L.new(k.outputs[0], e.inputs[0])
    inv = N.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1.0; L.new(e.outputs[0], inv.inputs[1])
    fac = N.new("ShaderNodeMath"); fac.operation = "MULTIPLY"; fac.inputs[1].default_value = .82; L.new(inv.outputs[0], fac.inputs[0])
    col = N.new("ShaderNodeRGB"); col.name = "Haze"
    em = N.new("ShaderNodeEmission"); L.new(col.outputs[0], em.inputs["Color"])
    mx = N.new("ShaderNodeMixShader")
    L.new(fac.outputs[0], mx.inputs[0]); L.new(gi.outputs[0], mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], go.inputs[0])
    frames = sorted({*range(0, LAST + 1, 6), LAST})
    at = lambda f: [*HAZE(f), 1.0]
    for i in range(4):
        bake(g, 'nodes["Haze"].outputs[0].default_value', [(f, at(f)[i]) for f in frames], index=i)
    # 교차로에서는 거리가 수십 미터라 안개를 짙게 해 먼 건물을 밤빛에 묻는다.
    dense = split([(0, 1.0), (OLD_LAST, 1.0)], [(ANCHORS[7] - 20, STREET_HAZE), (ANCHORS[7], STREET_HAZE), (STREET_OFF - 20, 1.0), (LAST, 1.0)])
    bake(g, 'nodes["HazeK"].inputs[1].default_value', [(f, -dense(f) / 1500) for f in frames])
    for m in list(bpy.data.materials):
        if not m.node_tree: continue
        out = next((n for n in m.node_tree.nodes if n.type == "OUTPUT_MATERIAL"), None)
        if out is None or not out.inputs["Surface"].links: continue
        src = out.inputs["Surface"].links[0].from_socket
        node = m.node_tree.nodes.new("ShaderNodeGroup"); node.node_tree = g
        m.node_tree.links.new(src, node.inputs[0]); m.node_tree.links.new(node.outputs[0], out.inputs["Surface"])
        # 안개의 발광이 조명으로 샘플링되지 않도록. 조명은 면광원만 맡는다.
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
    for key, val in (("Threshold", 1.0), ("Smoothness", .3), ("Strength", .42), ("Size", .62), ("Saturation", 1.0)):
        try: gl.inputs[key].default_value = val
        except Exception as e: print("GLARE", key, e)
    out = N.new("NodeGroupOutput")
    L.new(rl.outputs["Image"], gl.inputs["Image"]); L.new(gl.outputs["Image"], out.inputs[0])
    # 교차로에서는 가까운 창이 많아 번짐이 화면 전체를 회색으로 덮는다. 480 뒤에만 줄인다.
    gl.name = "Glare"
    idx = next((i for i, x in enumerate(gl.inputs) if x.name == "Strength"), None)
    if idx is not None:
        k = split([(0, .42), (OLD_LAST, .42)], [(ANCHORS[7] - 20, STREET_BLOOM), (ANCHORS[7], STREET_BLOOM), (STREET_OFF - 10, .42), (LAST, .42)])
        bake(ng, f'nodes["Glare"].inputs[{idx}].default_value', [(f, k(f)) for f in sorted({*range(0, LAST + 1, 6), LAST})])
    S.compositing_node_group = ng
    S.render.use_compositing = True


# ── 라벨 좌표 ─────────────────────────────────────────────────────────
def export_track():
    cam = S.camera
    anchors = {"house": Vector((4.5, 0, 9.5)), **{k: v for k, v in CITY_LABELS.items()}}
    out = {"fps": FPS, "frames": LAST + 1, "width": W, "height": H, "anchors": ANCHORS, "labels": {}, "pulses": []}
    series = {k: [] for k in anchors}
    for f in range(LAST + 1):
        S.frame_set(f)
        for k, v in anchors.items():
            p = world_to_camera_view(S, cam, v)
            vis = p.z > 0 and -.05 < p.x < 1.05 and -.05 < p.y < 1.05
            series[k].append([round(p.x * W, 1), round((1 - p.y) * H, 1), 1 if vis else 0])
    out["labels"] = series
    S.frame_set(ANCHORS[6])
    pts = []
    for v in PULSE_POINTS:
        p = world_to_camera_view(S, cam, v)
        if p.z > 0 and .03 < p.x < .97 and .06 < p.y < .9:
            pts.append([round(p.x * W, 1), round((1 - p.y) * H, 1), round(p.z, 1)])
    out["pulses"] = pts
    # 7단계 반복 영상 안의 판단: 몇 번째 프레임에, 화면 어디서(카드가 가리킬 자리)
    S.frame_set(STREET)
    dec = {}
    for k, d in DECISIONS.items():
        p = world_to_camera_view(S, cam, Vector(d["at"]))
        dec[k] = {"t": d["t"], "x": round(p.x * W, 1), "y": round((1 - p.y) * H, 1)}
    out["street"] = {"loop": LOOP, "fps": FPS, "decisions": dec}
    TRACK.parent.mkdir(parents=True, exist_ok=True)
    TRACK.write_text(json.dumps(out, separators=(",", ":")))
    print("TRACK", len(pts), "pulse points")


# ── 실행 ─────────────────────────────────────────────────────────────
t0 = time.time()
build_world()
build_house()
build_landscape()
build_blueprint()
build_city()
build_street()
SHAKE[:] = [(p.frames[1] - 3, .035) for p in PARTS if p.land == "heavy"]
build_camera()
bake_parts()
if A.mode != "loop":
    bake_agents()
add_haze()
add_bloom()
print(f"BUILD {time.time() - t0:.1f}s objects={len(bpy.data.objects)}")


def set_time_of_day(kind):
    """마지막 정지 지점(LAST)의 값만 바꾼다. 카메라·부품은 그대로라 13번의 밤 장면과 같은 구도다."""
    if kind == "night": return
    sky = dict(blue=(-3.4, 1.1, .2, 1.05), sunrise=(1.1, 1.0, 0.0, -.25))[kind]
    lit = dict(blue=(.7, 1.0), sunrise=(.1, .55))[kind]   # (도시 창문, 집 안의 불)

    def at_last(idb, path, value):
        ad = idb.animation_data
        if not ad or not ad.action: return
        fc = ad.action.fcurve_ensure_for_datablock(idb, path)
        for k in fc.keyframe_points:
            if k.co.x >= LAST - .5: k.co.y = value
        fc.update()
    nt = S.world.node_tree
    if kind == "sunrise":  # 해가 도시 뒤, 화면 안쪽 지평선에서 떠오른다. 공기를 조금 짙게 해 주황빛을 살린다.
        nt.nodes["Sky"].sun_rotation = math.radians(118); nt.nodes["Sky"].aerosol_density = 3.2; nt.nodes["Sky"].air_density = 1.5
    at_last(nt, 'nodes["Sky"].sun_elevation', math.radians(sky[0]))
    at_last(nt, 'nodes["Background"].inputs[1].default_value', sky[1])
    at_last(nt, 'nodes["Stars"].outputs[0].default_value', sky[2])
    at_last(S, "view_settings.exposure", sky[3])
    rng = random.Random(7)
    for ob in S.objects:
        if "lit" not in ob.keys(): continue
        city = ob.name.startswith("bldg")
        # 해가 뜨면 도시의 창문은 대부분 꺼지고, 몇 곳만 남는다.
        v = (lit[0] if rng.random() < .35 else lit[0] * .15) if city else lit[1]
        at_last(ob, '["lit"]', v)
    print("TIME", kind, sky, lit)


set_time_of_day(A.time)
export_track()

def verify_holds():
    """정지 프레임 앞뒤로 움직이는 것이 있으면 모션 블러가 남는다. 카메라와 모든 오브젝트를 비교한다."""
    bad = []
    obs = [o for o in S.objects if o.type in ("MESH", "CAMERA", "LIGHT")]
    for f in ANCHORS:
        mats = {}
        for g in (f - 1, f, f + 1):
            if g < 0 or g > LAST: continue
            S.frame_set(g)
            for o in obs:
                if o.hide_render or o.name.startswith("street · "): continue   # 교차로의 차와 로봇은 반복 영상이 맡는다
                mats.setdefault(o.name, {})[g] = o.matrix_world.copy()
        for name, m in mats.items():
            ks = sorted(m)
            for a, b in zip(ks, ks[1:]):
                d = max(abs(x - y) for ra, rb in zip(m[a], m[b]) for x, y in zip(ra, rb))
                if d > 1e-4:
                    bad.append((f, name, a, b, round(d, 4)))
    for row in bad[:40]: print("MOVING", *row)
    print("VERIFY", "ok" if not bad else f"{len(bad)} moving at holds")


def layout_report():
    """정지 지점마다 도시와 집이 화면 어디에 오는지. 글 단(x 100~880)과 겹치는지 본다."""
    cam = S.camera
    city = [Vector((x, y, z)) for x in (X0 - BLOCK / 2, X0 + (COLS - 1) * PITCH + BLOCK / 2) for y in (Y0 - BLOCK / 2, Y0 + (ROWS - 1) * PITCH + BLOCK / 2) for z in (0, 60)]
    house = [Vector((x, y, z)) for x in (-12, 17.5) for y in (-13.6, 6.5) for z in (0, 8.7)]
    body = [Vector((x, y, z)) for x in (-12, 17.5) for y in (-6.5, 6.5) for z in (0, 8.7)]
    for k, f in enumerate(ANCHORS):
        S.frame_set(f)
        out = []
        for name, pts in (("city", city), ("lot", house), ("body", body)):
            ps = [world_to_camera_view(S, cam, v) for v in pts]
            if any(q.z <= 0 for q in ps): out.append(f"{name}: behind"); continue
            xs = [q.x * W for q in ps]; ys = [(1 - q.y) * H for q in ps]
            out.append(f"{name}: x {min(xs):.0f}~{max(xs):.0f} y {min(ys):.0f}~{max(ys):.0f}")
        print("LAYOUT", k, f, " | ".join(out))


def path_report():
    """교차로로 내려갔다 집으로 돌아오는 동안 카메라가 건물이나 나무에 너무 가까이 가는지."""
    boxes = [(o.name, o.location.x - o.scale.x / 2, o.location.x + o.scale.x / 2, o.location.y - o.scale.y / 2, o.location.y + o.scale.y / 2, o.scale.z)
             for o in S.objects if o.name.startswith("bldg")]
    trees = [(o.location.x, o.location.y, 12 * o.scale.z) for o in S.objects if o.name.startswith(("park tree", "garden tree"))]
    worst = []
    for f in range(KEEP, LAST + 1):
        S.frame_set(f)
        e = S.camera.matrix_world.translation
        for name, x0, x1, y0, y1, h in boxes:
            d = math.hypot(max(x0 - e.x, 0, e.x - x1), max(y0 - e.y, 0, e.y - y1))
            if e.z < h + 3 and d < 3: worst.append((f, name, round(d, 2), round(e.z, 1)))
        for x, y, h in trees:
            if e.z < h + 2 and math.hypot(e.x - x, e.y - y) < 4: worst.append((f, "tree", round(math.hypot(e.x - x, e.y - y), 2), round(e.z, 1)))
    for row in worst[:30]: print("NEAR", *row)
    print("PATH", "ok" if not worst else f"{len(worst)} close calls")


if A.mode == "verify":
    verify_holds()
if A.mode == "layout":
    layout_report()
    path_report()

if A.save:
    WORK.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK / "house-scroll.blend"))

if A.mode == "still":
    target = Path(A.out) if A.out else WORK / "stills"
    target.mkdir(parents=True, exist_ok=True)
    for f in [int(x) for x in (A.frames or ",".join(map(str, ANCHORS))).split(",") if x]:
        S.frame_set(f)
        S.render.filepath = str(target / f"f{f:04d}.png")
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"STILL {f} {time.time() - t:.1f}s")
elif A.mode == "loop":
    # 교차로 정지 지점의 반복 영상. 카메라와 도시는 STREET 프레임에 두고 차와 로봇만 t = 0..LOOP-1로 옮긴다.
    target = Path(A.out) if A.out else WORK / "loop"
    target.mkdir(parents=True, exist_ok=True)
    S.frame_set(STREET)
    ks = range(LOOP)
    if A.frames:
        a, b = [int(x) for x in A.frames.split("-")]
        ks = range(a, b + 1)
    for k in ks:
        out = target / f"f{k:04d}.png"
        if out.exists(): continue
        apply_agents(k)
        S.render.filepath = str(out)
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"LOOP {k} {time.time() - t:.1f}s")
elif A.mode == "final":
    frames_dir = WORK / "frames"; frames_dir.mkdir(parents=True, exist_ok=True)
    S.render.filepath = str(frames_dir / "f")
    S.render.use_overwrite = False
    S.render.use_placeholder = True
    if A.frames:
        a, b = [int(x) for x in A.frames.split("-")]
        S.frame_start, S.frame_end = a, b
    bpy.ops.render.render(animation=True)
