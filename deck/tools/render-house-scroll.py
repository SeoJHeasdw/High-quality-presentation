#!/usr/bin/env python3
"""Keynote 12 · 스크롤 페이지 영상.

해 질 녘 빈 대지의 평면선 위로 집의 부품이 위·좌우에서 날아와 조립되고,
카메라가 물러나며 도시가 세워지고 불이 켜진 뒤, 다시 집으로 내려온다.
페이지는 이 영상을 스크롤 위치로 스크럽한다. 멈추는 지점(ANCHORS)에서는
카메라와 부품이 모두 정지해 있어 모션 블러 없이 선명하다.

  blender -b --python deck/tools/render-house-scroll.py -- --mode still --frames 0,84,168 --scale 50
  blender -b --python deck/tools/render-house-scroll.py -- --mode final
  blender -b --python deck/tools/render-house-scroll.py -- --mode track   # 라벨 좌표만 다시 계산

결과 프레임은 render/house-scroll/frames/, 라벨 좌표는 src/keynote/next-market/track.json.
인코딩은 tools/encode-house-scroll.sh.
"""
import bpy, math, json, sys, argparse, random, time, zlib
from pathlib import Path
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/house-scroll"
TRACK = ROOT / "src/keynote/next-market/track.json"
WORK = ROOT / "render/house-scroll"
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mode", choices=["still", "final", "track", "verify", "layout"], default="still")
ap.add_argument("--frames", default="")
ap.add_argument("--samples", type=int, default=0)
ap.add_argument("--scale", type=int, default=0, help="resolution percentage")
ap.add_argument("--out", default="")
ap.add_argument("--save", action="store_true")
ap.add_argument("--shots", default="", help='구도 실험: {"5": {"eye": [x, y, z]}}')
A = ap.parse_args(ARGS)

FPS = 30
# 발표자가 멈추는 지점. 페이지의 단계(0~7)와 1:1로 대응한다.
ANCHORS = [0, 84, 168, 252, 342, 420, 480, 570]
LAST = ANCHORS[-1]
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
    L.new(M("MULTIPLY", M("MULTIPLY", glow, bright), level), b.inputs["Emission Strength"])
    cf, ca, cb, co = mix_rgb(N)
    ca.default_value = (.74, .85, 1.0, 1); cb.default_value = (1.0, .86, .68, 1)
    L.new(M("MAXIMUM", M("SUBTRACT", 1, office), M("GREATER_THAN", noise4(floor, colo, 6.0), .8)), cf)
    gf, ga, gb, go = mix_rgb(N)
    L.new(co, ga); gb.default_value = (1.0, .56, .16, 1)
    L.new(warm, gf)
    L.new(go, b.inputs["Emission Color"])
    # 외벽: 사무동은 어두운 반사 유리, 주거동은 어두운 석재
    bf, ba, bb, bo = mix_rgb(N)
    ba.default_value = (.05, .046, .042, 1); bb.default_value = (.014, .018, .024, 1)
    L.new(M("MAXIMUM", office, M("MULTIPLY", window, .7)), bf); L.new(bo, b.inputs["Base Color"])
    L.new(M("SUBTRACT", .78, M("MULTIPLY", M("MAXIMUM", office, window), .68)), b.inputs["Roughness"])
    b.inputs["Specular IOR Level"].default_value = .65
    no_emission_sampling(m)
    return m


def build_city():
    fac = building_material()
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
            PROPS.append((lights, "lit", [(0, 0), (int(rise0 + 8), 0), (int(rise0 + 30), 1), (LAST, 1)]))
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
    elev = [(0, -.9), (252, -2.2), (342, -3.6), (420, -5.2), (480, -6.4), (LAST, -6.8)]
    strength = [(0, 1.0), (252, 1.0), (420, 1.25), (LAST, 1.35)]
    starsv = [(0, 0), (300, 0), (420, .6), (LAST, .9)]

    def piece(tbl, f):
        for (f0, v0), (f1, v1) in zip(tbl, tbl[1:]):
            if f0 <= f <= f1: return lerp(v0, v1, ease_io((f - f0) / (f1 - f0)))
        return tbl[-1][1]
    bake(w.node_tree, 'nodes["Sky"].sun_elevation', [(f, math.radians(piece(elev, f))) for f in frames])
    bake(w.node_tree, 'nodes["Background"].inputs[1].default_value', [(f, piece(strength, f)) for f in frames])
    bake(w.node_tree, 'nodes["Stars"].outputs[0].default_value', [(f, piece(starsv, f)) for f in frames])
    expo = [(0, .95), (168, 1.0), (252, 1.0), (342, 1.25), (420, 1.4), (480, 1.5), (LAST, 1.35)]
    bake(S, "view_settings.exposure", [(f, piece(expo, f)) for f in frames])


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
    dict(eye=(-12, -40, 1.9), at=(1, 0, 7.5), lens=26, shift=-.14, fstop=11),
]
# 전환 사이에 거쳐 가는 점(부드러운 궤적을 위해)
VIA = {
    3: [(40, -60, 40), (110, 20, 140)],
    4: [(-80, 40, 520)],
    5: [(-470, 0, 560)],
    6: [(-300, 60, 80), (-90, -60, 12)],
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

    def eye_at(k, s):
        pts = segs[k]
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
HAZE = [(0, (.075, .066, .085)), (252, (.05, .05, .07)), (342, (.03, .036, .058)), (420, (.018, .025, .046)), (LAST, (.014, .02, .04))]


def add_haze():
    """먼 곳일수록 하늘빛에 묻힌다. 모든 재질의 출력 앞에 같은 그룹을 끼운다."""
    g = bpy.data.node_groups.new("haze", "ShaderNodeTree")
    g.interface.new_socket("Shader", in_out="INPUT", socket_type="NodeSocketShader")
    g.interface.new_socket("Shader", in_out="OUTPUT", socket_type="NodeSocketShader")
    N, L = g.nodes, g.links
    gi, go = N.new("NodeGroupInput"), N.new("NodeGroupOutput")
    cam = N.new("ShaderNodeCameraData")
    k = N.new("ShaderNodeMath"); k.operation = "MULTIPLY"; k.inputs[1].default_value = -1 / 1500
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
SHAKE[:] = [(p.frames[1] - 3, .035) for p in PARTS if p.land == "heavy"]
build_camera()
bake_parts()
add_haze()
add_bloom()
print(f"BUILD {time.time() - t0:.1f}s objects={len(bpy.data.objects)}")
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
                if o.hide_render: continue
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


if A.mode == "verify":
    verify_holds()
if A.mode == "layout":
    layout_report()

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
elif A.mode == "final":
    frames_dir = WORK / "frames"; frames_dir.mkdir(parents=True, exist_ok=True)
    S.render.filepath = str(frames_dir / "f")
    S.render.use_overwrite = False
    S.render.use_placeholder = True
    if A.frames:
        a, b = [int(x) for x in A.frames.split("-")]
        S.frame_start, S.frame_end = a, b
    bpy.ops.render.render(animation=True)
