#!/usr/bin/env python3
"""Keynote 15 · 『몫: 인간의 자리』(백승헌, 파지트 2026.11.1). 14번의 "누가 멈출 수 있는지" 다음 장.

0단계(0~120): 표지의 빛(문, 사람의 그림자, 입자 얼굴, 데이터 격자)을 점 수십만 개로 공간에 흩어 둔다. 점마다 한 카메라 자리에서 본
표지의 그 픽셀 위에 놓여 있어서, 카메라가 그 자리에 닿는 순간 흩어진 점들이 표지 그림으로 맞춰진다.
그 자리에서 표지 글자가 찍히며 책이 단단해지고, 카메라가 왼쪽으로 돌아 책등을 보이며 책을 화면 왼쪽에 세운다.
글자(제목·부제·저자·출판사)는 점으로 만들지 않는다. 책이 단단해질 때 표지와 함께 나타난다.
1단계(120~260): 책이 뒤로 눕고, 가운데가 펼쳐지며 낱장이 촤라락 넘어간다. 카메라가 올라가 펼친 면(240·241쪽)을 내려다보고,
241쪽에 형광펜을 칠한 인용 문장으로 빨려 들어가 종이가 하얗게 찬다. 그 흰빛이 표지 속 문의 빛이 되어, 문 앞에 선 사람을 뒤에서 보는
점의 복도(0단계의 첫 장면)로 빠져나온다. 오른쪽에 덱의 인용 글이 선다.
꼬리(261~680): 덱은 쓰지 않는다. 책 소개 영상(tools/build-book-promo.mjs)이 인용과 끝 화면을 띄우는 동안 문 쪽으로 천천히 다가간다.

  blender -b --python tools/render-book.py -- --mode still --frames 12,40,70,92,120 --scale 50
  blender -b --python tools/render-book.py -- --mode final          # render/book/frames/f0000.png … f0260.png
  blender -b --python tools/render-book.py -- --mode final --frames 261-680   # 꼬리(책 소개 영상만)
  tools/encode-book.sh                                              # public/book/seg-0·1.mp4, a-0·1·2.jpg
"""
import bpy, bmesh, math, sys, argparse, time
import numpy as np
from pathlib import Path
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "render/book"
COVER = ROOT / "public/book/cover.jpg"
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mode", choices=["still", "final"], default="still")
ap.add_argument("--frames", default="")
ap.add_argument("--samples", type=int, default=0)
ap.add_argument("--scale", type=int, default=0)
ap.add_argument("--save", action="store_true")
A = ap.parse_args(ARGS)

FPS = 30
# 정지 지점: 0은 14번에서 들어오는 어둠, 1은 책이 왼쪽에 선 화면(0단계 끝), 2는 문 앞의 사람(1단계 끝). tools/encode-book.sh와 같아야 한다.
ANCHORS = [0, 120, 260]
END0, LAST = ANCHORS[1], ANCHORS[-1]
ALIGN = 70           # 흩어진 점이 표지로 맞춰지는 프레임
SOLID = (76, 92)     # 표지 글자가 찍히며 책이 단단해지는 구간
TURN = (86, END0)    # 카메라가 돌아 책을 왼쪽에 세우는 구간
TIP = (122, 146)     # 1단계: 책이 뒤로 눕는다(146~154 작게 튀었다 멈춘다)
OPEN = (150, 168)    # 가운데가 펼쳐진다(앞 절반이 책등을 축으로 넘어간다)
RIFFLE = (158, 1.1, 10)  # 낱장이 넘어가기 시작하는 프레임, 낱장 사이 간격, 한 장이 넘어가는 길이
TOP = 190            # 카메라가 펼친 면을 위에서 내려다본다
DIVE = 228           # 인용 문장으로 빨려 들어가 하얗게 찬 마지막 프레임. 다음 프레임은 복도다
TAIL, PUSH = 420, 2.5  # 꼬리 프레임 수와 그동안 문 쪽으로 다가가는 거리(문이 약 11% 커진다)

# ── 장면 ─────────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene
S.render.engine = "CYCLES"
S.cycles.device = "GPU"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "METAL"
prefs.get_devices()
for d in prefs.devices: d.use = d.type == "METAL"
S.cycles.samples = A.samples or (96 if A.mode == "final" else 48)
S.cycles.use_adaptive_sampling = True
S.cycles.adaptive_threshold = 0.02
S.cycles.use_denoising = True
S.cycles.denoiser = "OPENIMAGEDENOISE"
S.cycles.denoising_use_gpu = True
S.cycles.max_bounces, S.cycles.diffuse_bounces, S.cycles.glossy_bounces = 6, 2, 3
S.cycles.transparent_max_bounces = 16
S.cycles.sample_clamp_indirect = 4.0
S.cycles.caustics_reflective = S.cycles.caustics_refractive = False
S.render.resolution_x, S.render.resolution_y = 1920, 1080
S.render.resolution_percentage = A.scale or (100 if A.mode == "final" else 50)
S.render.fps = FPS
S.frame_start, S.frame_end = 0, LAST
S.render.image_settings.file_format = "PNG"
# 맞춰지는 순간의 점 그림이 표지 파일과 같은 색이어야 한다: 톤 매핑 없이 그대로 낸다.
S.view_settings.view_transform = "Standard"
S.view_settings.look = "None"

# 표지 바탕의 남색(약 sRGB 0.03, 0.03, 0.055). 맞춰지는 순간 표지 밖과 안의 어둠이 같은 색이다.
BG = (0.0024, 0.0024, 0.0045)
W = bpy.data.worlds.new("World"); S.world = W
W.use_nodes = True
W.node_tree.nodes["Background"].inputs[0].default_value = (*BG, 1)
W.node_tree.nodes["Background"].inputs[1].default_value = 1.0

def link(ob):
    S.collection.objects.link(ob); return ob

def nodes_of(m):
    m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL": nt.nodes.remove(n)
    return nt, nt.nodes["Material Output"]

def key_input(sock, samples):
    for f, v in samples:
        sock.default_value = v; sock.keyframe_insert("default_value", frame=f)

def smooth(t):
    t = max(0.0, min(1.0, t)); return t * t * t * (t * (t * 6 - 15) + 10)

def ramp(f, f0, f1): return smooth((f - f0) / (f1 - f0))

# ── 표지와 그 자리 ────────────────────────────────────────────────────
# 맞춰지는 자리의 카메라는 원점에서 +Y를 본다. 책 앞면은 y = YB에 서 있고 화면 높이의 FILL만큼 찬다.
LENS, SENSOR = 35.0, 36.0
TAN_V = (SENSOR * 1080 / 1920) / 2 / LENS
FILL = 0.78
img = bpy.data.images.load(str(COVER)); img.colorspace_settings.name = "sRGB"
IW, IH = img.size
BH = 2.1                      # 실제 210mm를 10배로 둔다(145 × 210 × 20mm, 277쪽)
BW = BH * IW / IH
BT = 0.2
YB = BH / (FILL * 2 * TAN_V)

def on_plane(px, py):
    """표지 픽셀 (px, py: 왼쪽 위 원점) → 책 앞면 위의 점(x, z)."""
    return (px / IW - 0.5) * BW, (0.5 - py / IH) * BH

# ── 점: 표지 픽셀마다 한 개, 그 픽셀을 지나는 시선 위의 깊이에 놓는다 ─────────
D_DOOR = 40.0                 # 문과 사람
HORIZON = 868                 # 표지에서 바닥이 문에 닿는 줄(px)
DOOR = (492, 600, 592, 885)   # 문 판과 빛, 사람(px)
XW = 3.0                      # 좌우 유리판이 서는 벽
LMIN = 0.08

def build_points():
    t0 = time.time()
    px = np.array(img.pixels[:], dtype=np.float32).reshape(IH, IW, 4)[::-1, :, :3]  # 위가 0번 줄
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    L = 0.2126 * r + 0.7152 * g + 0.0722 * b
    # 글자: 베이지(제목·부제·영문·저자·출판사)와 "몫"의 흰 글자. 세 픽셀 넓혀 가장자리까지 뺀다.
    yy, xx = np.mgrid[0:IH, 0:IW]
    text = ((r > b + 0.08) & (L > 0.35)) | ((L > 0.8) & (np.abs(r - b) < 0.08) & (xx >= 128) & (xx <= 396) & (yy >= 285) & (yy <= 610))
    # 영문 아래와 부제 아래의 가는 줄. 흐린 픽셀이라 위 색 기준에 다 걸리지 않는다.
    for y0, y1 in ((112, 123), (1016, 1031)):
        text |= (yy >= y0) & (yy <= y1) & (xx >= 252) & (xx <= 574) & (r > b + 0.02) & (L > 0.1)
    grow = text.copy()
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            grow |= np.roll(np.roll(text, dy, 0), dx, 1)
    # 글자를 뺀 자리는 둘레의 색으로 메운다. 비워 두면 바닥 빛 위에 부제가 검은 구멍으로 남는다.
    px = px.copy(); known = (~grow).astype(np.float32)
    def box(a, rad):
        for axis in (0, 1):
            c = np.cumsum(np.pad(a, [(rad + 1, rad) if i == axis else (0, 0) for i in range(a.ndim)], mode="edge"), axis=axis)
            a = (np.take(c, range(2 * rad + 1, c.shape[axis]), axis=axis) - np.take(c, range(0, c.shape[axis] - 2 * rad - 1), axis=axis)) / (2 * rad + 1)
        return a
    todo = grow.copy()
    for rad in (3, 6, 12, 24, 48, 96):
        den = box(known, rad); num = box(px * known[..., None], rad)
        ok = todo & (den > 0.15)
        px[ok] = num[ok] / den[ok][:, None]; todo &= ~ok
    px[todo] = 0.03                                                  # "몫"의 굵은 획 한가운데: 바탕의 어둠
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    L = 0.2126 * r + 0.7152 * g + 0.0722 * b
    keep = L > LMIN
    ys, xs = np.nonzero(keep)
    X, Z = on_plane(xs + 0.5, ys + 0.5)
    rng = np.random.default_rng(15)
    depth = rng.uniform(12.0, 42.0, xs.size)                       # 데이터 격자와 나머지
    door = (xs >= DOOR[0]) & (xs <= DOOR[2]) & (ys >= DOOR[1]) & (ys <= DOOR[3])
    zf = on_plane(0, HORIZON)[1] / YB * D_DOOR                      # 지평선의 시선이 문 앞에서 바닥에 닿는다
    floor = (ys > HORIZON) & ~door
    side = (ys >= 540) & (ys <= HORIZON) & ~door & ((xs < DOOR[0]) | (xs > DOOR[2]))
    face = (xs >= 560) & (ys <= 470)
    depth[floor] = np.clip(zf * YB / np.minimum(Z[floor], -1e-3), YB + 1.0, D_DOOR)
    depth[side] = np.clip(XW * YB / np.maximum(np.abs(X[side]), 1e-3) + rng.normal(0, 0.4, side.sum()), YB + 2.0, D_DOOR)
    depth[face] = 27.0 + 4.0 * (1 - (xs[face] - 560) / (IW - 560)) + rng.normal(0, 0.3, face.sum())
    depth[door] = D_DOOR + rng.normal(0, 0.15, door.sum())
    k = depth / YB
    co = np.stack([X * k, depth, Z * k], 1).astype(np.float32)
    lin = np.where(px[ys, xs] <= 0.04045, px[ys, xs] / 12.92, ((px[ys, xs] + 0.055) / 1.055) ** 2.4)
    col = np.concatenate([lin, np.ones((xs.size, 1))], 1).astype(np.float32)
    rad = (0.62 * BH / IH * k).astype(np.float32)                 # 맞춰지는 자리에서 한 픽셀을 덮는 크기
    me = bpy.data.meshes.new("CoverPoints")
    me.vertices.add(xs.size); me.vertices.foreach_set("co", co.ravel())
    me.attributes.new("col", "FLOAT_COLOR", "POINT").data.foreach_set("color", col.ravel())
    me.attributes.new("rad", "FLOAT", "POINT").data.foreach_set("value", rad)
    ob = link(bpy.data.objects.new("CoverPoints", me))
    # 점 재질: 표지 색 그대로의 빛. 수십만 개라 광원으로 세지 않는다.
    m = bpy.data.materials.new("Points"); nt, out = nodes_of(m); m.cycles.emission_sampling = "NONE"
    at = nt.nodes.new("ShaderNodeAttribute"); at.attribute_name = "col"; at.attribute_type = "GEOMETRY"
    em = nt.nodes.new("ShaderNodeEmission"); nt.links.new(at.outputs["Color"], em.inputs["Color"])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(em.outputs[0], mix.inputs[2]); nt.links.new(mix.outputs[0], out.inputs[0])
    # 책이 단단해지는 동안(책이 점을 다 가린다) 점을 걷는다. 남겨 두면 카메라가 돌 때 얼굴·격자가 시차로 어긋나
    # 책에서 떨어져 나가는 표지 사본처럼 보인다. 1단계 끝의 복도에서 다시 켠다.
    key_input(mix.inputs[0], [(TURN[0] - 1, 1.0), (TURN[0] + 6, 0.0), (DIVE, 0.0), (DIVE + 1, 1.0)])
    ng = bpy.data.node_groups.new("Points", "GeometryNodeTree")
    ng.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    gi, go = ng.nodes.new("NodeGroupInput"), ng.nodes.new("NodeGroupOutput")
    mp = ng.nodes.new("GeometryNodeMeshToPoints")
    na = ng.nodes.new("GeometryNodeInputNamedAttribute"); na.data_type = "FLOAT"; na.inputs["Name"].default_value = "rad"
    sm = ng.nodes.new("GeometryNodeSetMaterial"); sm.inputs["Material"].default_value = m
    ng.links.new(gi.outputs[0], mp.inputs["Mesh"]); ng.links.new(na.outputs["Attribute"], mp.inputs["Radius"])
    ng.links.new(mp.outputs[0], sm.inputs["Geometry"]); ng.links.new(sm.outputs[0], go.inputs[0])
    ob.modifiers.new("Points", "NODES").node_group = ng
    print(f"points {xs.size:,} ({time.time() - t0:.1f}s)  door {door.sum():,} floor {floor.sum():,} side {side.sum():,} face {face.sum():,}")
    return ob

POINTS = build_points()

# ── 책 ───────────────────────────────────────────────────────────────
def cover_material():
    """앞표지: 맞춰지는 순간에는 표지 파일 그대로(빛), 돌아설 때는 조명을 받는 무광 코팅 종이.
    실물에서 "인간의 자리"만 금박이라 빛을 되받는다(render/book/foil.png)."""
    m = bpy.data.materials.new("Cover"); nt, out = nodes_of(m)
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img; tex.interpolation = "Cubic"
    fo = nt.nodes.new("ShaderNodeTexImage"); fo.image = bpy.data.images.load(str(WORK / "foil.png")); fo.image.colorspace_settings.name = "Non-Color"
    p = nt.nodes.new("ShaderNodeBsdfPrincipled"); p.inputs["Specular IOR Level"].default_value = 0.35
    rough = nt.nodes.new("ShaderNodeMapRange"); rough.inputs[3].default_value = 0.66; rough.inputs[4].default_value = 0.2
    nt.links.new(fo.outputs["Color"], rough.inputs[0]); nt.links.new(rough.outputs[0], p.inputs["Roughness"])
    nt.links.new(fo.outputs["Color"], p.inputs["Metallic"])
    nt.links.new(tex.outputs["Color"], p.inputs["Base Color"]); nt.links.new(tex.outputs["Color"], p.inputs["Emission Color"])
    key_input(p.inputs["Emission Strength"], [(SOLID[1], 1.0), (TURN[0] + 26, 0.82)])
    return m, p

def spine_material():
    """책등: 표지에서 오린 글자로 실물 배치를 다시 짠 그림(tools/export-book-textures.py)."""
    m = bpy.data.materials.new("Spine"); nt, out = nodes_of(m)
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(str(WORK / "spine.png")); tex.interpolation = "Cubic"
    p = nt.nodes.new("ShaderNodeBsdfPrincipled"); p.inputs["Roughness"].default_value = 0.55
    nt.links.new(tex.outputs["Color"], p.inputs["Base Color"]); nt.links.new(tex.outputs["Color"], p.inputs["Emission Color"])
    key_input(p.inputs["Emission Strength"], [(SOLID[1], 1.0), (TURN[0] + 26, 0.7)])
    return m, nt, out, p

def solid_mix(m, nt, out, shader_out):
    tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(shader_out, mix.inputs[2]); nt.links.new(mix.outputs[0], out.inputs[0])
    key_input(mix.inputs[0], [(SOLID[0], 0.0), (SOLID[1], 1.0)])

def pages_material():
    """종이 단면: 상아색에 낱장의 결. 낱장 139장(277쪽)이 두께 0.2에 놓인다."""
    m = bpy.data.materials.new("Pages"); nt, out = nodes_of(m)
    p = nt.nodes.new("ShaderNodeBsdfPrincipled"); p.inputs["Roughness"].default_value = 0.75
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (0.0, 139 / BT, 0.0)
    wv = nt.nodes.new("ShaderNodeTexWave"); wv.wave_type = "BANDS"; wv.bands_direction = "Y"
    wv.inputs["Scale"].default_value = 1.0; wv.inputs["Distortion"].default_value = 0.6; wv.inputs["Detail"].default_value = 1.5
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"]); nt.links.new(mp.outputs[0], wv.inputs["Vector"])
    cr = nt.nodes.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = (0.56, 0.54, 0.49, 1); cr.color_ramp.elements[1].color = (0.80, 0.78, 0.72, 1)
    nt.links.new(wv.outputs["Fac"], cr.inputs[0]); nt.links.new(cr.outputs[0], p.inputs["Base Color"])
    return m, nt, out, p

def plain_material(name, color, rough):
    m = bpy.data.materials.new(name); nt, out = nodes_of(m)
    p = nt.nodes.new("ShaderNodeBsdfPrincipled"); p.inputs["Base Color"].default_value = (*color, 1); p.inputs["Roughness"].default_value = rough
    return m, nt, out, p

def build_book():
    me = bpy.data.meshes.new("Book"); bm = bmesh.new()
    x0, x1, y0, y1, z0, z1 = -BW / 2, BW / 2, YB, YB + BT, -BH / 2, BH / 2
    v = [bm.verts.new(c) for c in ((x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1), (x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1))]
    # 앞, 뒤, 책등(왼쪽), 배, 위, 아래. 책등은 왼쪽에서 볼 때 앞표지 쪽이 오른쪽이다.
    faces = [((0, 1, 2, 3), 0), ((5, 4, 7, 6), 1), ((4, 0, 3, 7), 3), ((1, 5, 6, 2), 2), ((3, 2, 6, 7), 2), ((4, 5, 1, 0), 2)]
    uv = bm.loops.layers.uv.new("UV")
    for idx, mat in faces:
        f = bm.faces.new([v[i] for i in idx]); f.material_index = mat
        for loop in f.loops:
            c = loop.vert.co
            loop[uv].uv = ((c.x - x0) / BW, (c.z - z0) / BH) if mat == 0 else ((y1 - c.y) / BT, (c.z - z0) / BH) if mat == 3 else (0.0, 0.0)
    bm.to_mesh(me); bm.free()
    ob = link(bpy.data.objects.new("Book", me))
    cm, cp = cover_material(); solid_mix(cm, cm.node_tree, cm.node_tree.nodes["Material Output"], cp.outputs[0])
    bm_, bnt, bout, bp = plain_material("Board", (0.006, 0.010, 0.026), 0.42); solid_mix(bm_, bnt, bout, bp.outputs[0])
    pm, pnt, pout, pp = pages_material(); solid_mix(pm, pnt, pout, pp.outputs[0])
    sm, snt, sout, spp = spine_material(); solid_mix(sm, snt, sout, spp.outputs[0])
    for m in (cm, bm_, pm, sm): me.materials.append(m)
    bv = ob.modifiers.new("Bevel", "BEVEL"); bv.width = 0.004; bv.segments = 2; bv.harden_normals = True
    return ob, (cm, bm_, pm, sm)

# 책이 눕는 축: 뒤표지의 아래 모서리. 닫힌 책(0단계에서 쓴 상자)과 펼칠 책의 조각이 모두 여기에 매달린다.
ROOT = link(bpy.data.objects.new("BookRoot", None)); ROOT.location = (0, YB + BT, -BH / 2)
def hang(ob, parent=None):
    parent = parent or ROOT
    ob.parent = parent; ob.matrix_parent_inverse = parent.matrix_world.inverted(); return ob

def visible(ob, keys):
    """keys: [(frame, 보임?)] 사이는 앞 값 그대로."""
    for f, on in keys:
        ob.hide_render = not on; ob.keyframe_insert("hide_render", frame=f)
    if ob.animation_data:
        for fc in fcurves_of(ob):
            for kp in fc.keyframe_points: kp.interpolation = "CONSTANT"

def fcurves_of(idb):
    """Blender 5의 계층 액션과 예전 액션 모두에서 F-curve를 꺼낸다."""
    act = idb.animation_data.action if idb.animation_data else None
    if act is None: return []
    if hasattr(act, "fcurves") and len(act.fcurves): return list(act.fcurves)
    out = []
    for layer in getattr(act, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags: out.extend(bag.fcurves)
    return out

BOOK, BOOK_MATS = build_book()
ROOT.matrix_world  # 행렬을 갱신해 둔다
bpy.context.view_layer.update()
hang(BOOK)
visible(BOOK, [(0, True), (OPEN[0], False), (DIVE + 1, False)])
visible(POINTS, [(0, True), (TURN[0] + 7, False), (DIVE + 1, True)])

# ── 펼칠 책: 앞 절반(앞표지 + 왼쪽 쪽들), 뒤 절반(뒤표지 + 오른쪽 쪽들), 그 사이의 낱장 ─────────────
# 닫혀 있을 때 0단계의 상자와 같은 자리·같은 겉모양이다. 펼치기 시작하는 프레임에 상자와 바꿔 끼운다.
# 경첩은 책등 쪽 가운데 두께(x = -BW/2, y = YH)다. 앞 절반과 낱장은 이 축으로 -180도 돌아 왼쪽에 눕는다.
N_LEAF, LEAF_T = 24, 0.0012
YH = YB + BT / 2
Y_FRONT = YH - N_LEAF * LEAF_T                     # 앞 절반의 안쪽 면. 낱장들이 이 사이를 채운다

def page_material(name, front, back=None):
    """낱장의 양면. back이 있으면 뒷면(+Y 쪽)에 그 그림을 좌우 뒤집어 붙인다(넘어간 뒤 왼쪽 쪽이 된다)."""
    m = bpy.data.materials.new(name); nt, out = nodes_of(m)
    uv = nt.nodes.new("ShaderNodeUVMap")
    p = nt.nodes.new("ShaderNodeBsdfPrincipled"); p.inputs["Roughness"].default_value = 0.8
    ta = nt.nodes.new("ShaderNodeTexImage"); ta.image = bpy.data.images.load(str(WORK / front)); ta.interpolation = "Cubic"
    nt.links.new(uv.outputs[0], ta.inputs["Vector"])
    col = ta.outputs["Color"]
    if back:
        tb = nt.nodes.new("ShaderNodeTexImage"); tb.image = bpy.data.images.load(str(WORK / back)); tb.interpolation = "Cubic"
        sep = nt.nodes.new("ShaderNodeSeparateXYZ"); comb = nt.nodes.new("ShaderNodeCombineXYZ"); inv = nt.nodes.new("ShaderNodeMath"); inv.operation = "SUBTRACT"
        inv.inputs[0].default_value = 1.0
        nt.links.new(uv.outputs[0], sep.inputs[0]); nt.links.new(sep.outputs[0], inv.inputs[1])
        nt.links.new(inv.outputs[0], comb.inputs[0]); nt.links.new(sep.outputs[1], comb.inputs[1]); nt.links.new(comb.outputs[0], tb.inputs["Vector"])
        geo = nt.nodes.new("ShaderNodeNewGeometry"); mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"
        nt.links.new(geo.outputs["Backfacing"], mx.inputs["Factor"]); nt.links.new(ta.outputs["Color"], mx.inputs[6]); nt.links.new(tb.outputs["Color"], mx.inputs[7])
        col = mx.outputs[2]
    nt.links.new(col, p.inputs["Base Color"])
    nt.links.new(p.outputs[0], out.inputs[0])
    return m

def box_part(name, y0, y1, mats, spine=True, faces=("front", "back", "spine", "edge", "top", "bottom")):
    """닫힌 책의 한 조각(y0~y1 두께). mats: 면 이름 → 재질 번호. 책등 면의 UV는 0단계 상자와 같아 이어 붙인다."""
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    x0, x1, z0, z1 = -BW / 2, BW / 2, -BH / 2, BH / 2
    v = [bm.verts.new(c) for c in ((x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1), (x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1))]
    quads = {"front": (0, 1, 2, 3), "back": (5, 4, 7, 6), "spine": (4, 0, 3, 7), "edge": (1, 5, 6, 2), "top": (3, 2, 6, 7), "bottom": (4, 5, 1, 0)}
    uv = bm.loops.layers.uv.new("UV")
    for key in faces:
        f = bm.faces.new([v[i] for i in quads[key]]); f.material_index = mats[key]
        for loop in f.loops:
            c = loop.vert.co
            if key in ("front", "back"): loop[uv].uv = ((c.x - x0) / BW, (c.z - z0) / BH)
            elif key == "spine": loop[uv].uv = ((YB + BT - c.y) / BT, (c.z - z0) / BH)
            else: loop[uv].uv = (0.0, 0.0)
    bm.to_mesh(me); bm.free()
    return link(bpy.data.objects.new(name, me))

def build_open_book():
    cm, bm_, pm, sm = BOOK_MATS
    p241 = page_material("Page241", "page-241.png"); solid_mix(p241, p241.node_tree, p241.node_tree.nodes["Material Output"], p241.node_tree.nodes["Principled BSDF"].outputs[0])
    pleft = page_material("PageLeft", "leaf-1.png"); solid_mix(pleft, pleft.node_tree, pleft.node_tree.nodes["Material Output"], pleft.node_tree.nodes["Principled BSDF"].outputs[0])
    mats = [cm, bm_, pm, sm, p241, pleft]                          # 0 표지, 1 판지, 2 종이 단면, 3 책등, 4 241쪽, 5 왼쪽 첫 쪽
    hinge = hang(link(bpy.data.objects.new("Hinge", None)))
    hinge.location = ROOT.matrix_world.inverted() @ Vector((-BW / 2, YH, 0))
    hinge.matrix_parent_inverse.identity()
    front = box_part("FrontHalf", YB, Y_FRONT, {"front": 0, "back": 5, "spine": 3, "edge": 2, "top": 2, "bottom": 2})
    back = box_part("BackHalf", YH, YB + BT, {"front": 4, "back": 1, "spine": 3, "edge": 2, "top": 2, "bottom": 2})
    filler = box_part("LeafBlock", Y_FRONT, YH, {"spine": 3, "edge": 2, "top": 2, "bottom": 2}, faces=("spine", "edge", "top", "bottom"))
    for ob in (front, back, filler):
        for m in mats: ob.data.materials.append(m)
    bpy.context.view_layer.update()
    hang(back); hang(filler); hang(front, hinge)
    # 앞 절반이 넘어간다: 천천히 들렸다가 빨라지고, 왼쪽에 닿을 때 다시 느려진다.
    for f in range(OPEN[0], OPEN[1] + 1):
        hinge.rotation_euler.z = -math.pi * smooth(ramp(f, *OPEN)); hinge.keyframe_insert("rotation_euler", index=2, frame=f)
    for ob in (front, back): visible(ob, [(0, False), (OPEN[0], True), (DIVE + 1, False)])
    visible(filler, [(0, False), (OPEN[0], True), (OPEN[0] + 3, False)])
    # 낱장: 오른쪽 더미의 맨 위(앞 절반 쪽)부터 한 장씩 넘어간다. 넘어가는 동안 종이가 휘었다 펴진다.
    leaf_mats = [page_material(f"Leaf{i}", f"leaf-{i}.png", f"leaf-{(i + 1) % 4}.png") for i in range(4)]
    last_mat = page_material("LeafLast", "leaf-0.png", "page-240.png")
    for m in leaf_mats + [last_mat]:
        solid_mix(m, m.node_tree, m.node_tree.nodes["Material Output"], m.node_tree.nodes["Principled BSDF"].outputs[0])
    start, gap, dur = RIFFLE
    for k in range(N_LEAF):
        me = bpy.data.meshes.new(f"Leaf{k}"); bm = bmesh.new(); uv = bm.loops.layers.uv.new("UV")
        nx, w, zh = 16, BW - 0.012, BH / 2 - 0.008
        dy = -(k + 0.5) * LEAF_T
        verts = [[bm.verts.new((0.004 + w * i / nx, dy, z)) for z in (-zh, zh)] for i in range(nx + 1)]
        for i in range(nx):
            f = bm.faces.new((verts[i][0], verts[i + 1][0], verts[i + 1][1], verts[i][1]))
            for loop, (u, vv) in zip(f.loops, ((i / nx, 0), ((i + 1) / nx, 0), ((i + 1) / nx, 1), (i / nx, 1))): loop[uv].uv = (u, vv)
        bm.to_mesh(me); bm.free()
        leaf = link(bpy.data.objects.new(f"Leaf{k}", me)); leaf.data.materials.append(last_mat if k == 0 else leaf_mats[k % 4])
        pivot = hang(link(bpy.data.objects.new(f"LeafPivot{k}", None)))
        pivot.location = ROOT.matrix_world.inverted() @ Vector((-BW / 2, YH, 0)); pivot.matrix_parent_inverse.identity()
        bpy.context.view_layer.update()
        leaf.location = (0, 0, 0); leaf.parent = pivot
        bd = leaf.modifiers.new("Curl", "SIMPLE_DEFORM"); bd.deform_method = "BEND"; bd.deform_axis = "Z"
        order = N_LEAF - 1 - k                                    # 맨 위(k가 큰 것)부터
        f0 = start + order * gap
        for f in range(int(f0) - 1, int(f0 + dur) + 2):
            t = max(0.0, min(1.0, (f - f0) / dur))
            pivot.rotation_euler.z = -math.pi * smooth(t); pivot.keyframe_insert("rotation_euler", index=2, frame=f)
            bd.angle = math.radians(55) * math.sin(math.pi * t); bd.keyframe_insert("angle", frame=f)
        visible(leaf, [(0, False), (OPEN[0], True), (DIVE + 1, False)])
    return hinge

build_open_book()
# 책이 뒤로 눕는다: 처음엔 천천히, 바닥에 닿을 때 가장 빠르고, 작게 튀었다 멈춘다.
for f in range(TIP[0], TIP[1] + 9):
    if f <= TIP[1]: a = -(math.pi / 2) * ((f - TIP[0]) / (TIP[1] - TIP[0])) ** 2
    else: a = -(math.pi / 2) + 0.045 * math.sin(math.pi * (f - TIP[1]) / 8) * (1 - (f - TIP[1]) / 9)
    ROOT.rotation_euler.x = a; ROOT.keyframe_insert("rotation_euler", index=0, frame=f)

# 책이 설 때 켜는 빛. 맞춰지는 순간에는 꺼져 있어 표지가 파일 그대로 보인다.
# Key는 카메라 쪽(왼쪽 앞)에서 책등과 표지를 비추고, Glint는 오른쪽 앞에서 금박에 되비친다(카메라가 돌며 빛이 글자를 훑는다).
def area(name, loc, target, size, energy_keys, color=(0.86, 0.92, 1.0)):
    ld = bpy.data.lights.new(name, "AREA"); ld.shape = "RECTANGLE"; ld.size, ld.size_y = size; ld.color = color
    ob = link(bpy.data.objects.new(name, ld)); ob.location = loc
    ob.rotation_mode = "QUATERNION"; ob.rotation_quaternion = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y")
    for f, e in energy_keys: ld.energy = e; ld.keyframe_insert("energy", frame=f)
    return ob

BOOK_C = Vector((0.0, YB + BT / 2, 0.0))

# 책이 돌아설 때 발밑에 깔리는 어두운 거울 바닥. 맞춰지는 동안에는 투명해서 점들을 가리지 않는다.
def build_floor():
    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, YB + 8, -BH / 2 - 0.002)); ob = bpy.context.object; ob.name = "Floor"
    m, nt, out, p = plain_material("Floor", (0.004, 0.006, 0.012), 0.09)
    p.inputs["Specular IOR Level"].default_value = 0.8
    tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(p.outputs[0], mix.inputs[2]); nt.links.new(mix.outputs[0], out.inputs[0])
    key_input(mix.inputs[0], [(TURN[0], 0.0), (TURN[0] + 18, 1.0), (DIVE, 1.0), (DIVE + 1, 0.0)])
    ob.data.materials.append(m)

build_floor()
# 책이 누우면 세 빛을 낮추고 위의 창(Top)으로 넘긴다.
area("Key", (-3.6, YB - 3.0, 1.7), BOOK_C, (3.0, 2.0), [(TURN[0], 0.0), (TURN[0] + 22, 150.0), (TIP[0], 150.0), (TIP[1], 45.0)])
area("Glint", (2.4, YB - 3.8, 0.9), BOOK_C, (1.2, 2.4), [(TURN[0], 0.0), (TURN[0] + 22, 170.0), (TIP[0], 170.0), (TIP[1], 0.0)], color=(1.0, 0.92, 0.82))
area("Rim", (-1.2, YB + 2.6, 1.8), BOOK_C + Vector((-0.6, 0, 0)), (1.6, 0.6), [(TURN[0], 0.0), (TURN[0] + 22, 140.0), (TIP[0], 140.0), (TIP[1], 0.0)], color=(0.55, 0.75, 1.0))  # 누우면 끈다(거울 바닥에 네모로 비친다)
# 누운 책의 펼친 면을 위에서 고르게 비추는 큰 창(1단계).
TOP_C = Vector((-BW / 2, YB + BT + BH / 2, -BH / 2 + BT / 2))
area("Top", TOP_C + Vector((0.4, -0.8, 4.2)), TOP_C, (4.5, 4.5), [(TIP[0], 0.0), (TIP[1] + 4, 100.0)], color=(1.0, 0.97, 0.92)).visible_glossy = False  # 거울 바닥에 빛의 네모가 비치지 않게

# ── 카메라 ───────────────────────────────────────────────────────────
cd = bpy.data.cameras.new("Cam"); cd.lens = LENS; cd.sensor_width = SENSOR; cd.sensor_fit = "HORIZONTAL"; cd.clip_start = 0.05; cd.clip_end = 400
cam = link(bpy.data.objects.new("Cam", cd)); S.camera = cam; cam.rotation_mode = "QUATERNION"
cd.dof.use_dof = True

DOOR_C = Vector((on_plane(541, 745)[0] * D_DOOR / YB, D_DOOR, on_plane(541, 745)[1] * D_DOOR / YB))
C0 = Vector((-0.55, 15.5, -1.25))                    # 흩어진 점 사이, 문을 보며 시작
C2_DIST, C2_ANG = 5.9, math.radians(-32)             # 책 중심에서의 거리와 돈 각(음수: 왼쪽으로 돌아 책등을 본다)
LEFT_THIRD = math.atan(math.tan(math.atan(SENSOR / 2 / LENS)) * 0.36)  # 책이 화면 왼쪽 1/3쯤에 서는 각

def look(eye, target, yaw=0.0):
    d = (target - eye).normalized()
    if yaw: d = Quaternion((0, 0, 1), -yaw) @ d
    return d.to_track_quat("-Z", "Y")

def frame_quat(forward):
    """시선과 위쪽 힌트로 카메라 회전을 만든다. 거의 수직으로 내려다볼 때는 화면 위가 책머리(+Y)를 향한다."""
    fw = forward.normalized()
    w = max(0.0, min(1.0, (abs(fw.z) - 0.5) / 0.4))
    hint = (Vector((0, 0, 1)) * (1 - w) + Vector((0, 1, 0)) * w).normalized()
    right = fw.cross(hint).normalized(); up = right.cross(fw)
    from mathutils import Matrix
    return Matrix((right, up, -fw)).transposed().to_quaternion()

def hermite(f, keys):
    """keys: [(frame, 값, 기울기)]. 구간마다 3차 에르미트로 잇는다(속도가 끊기지 않는다)."""
    for (f0, v0, m0), (f1, v1, m1) in zip(keys, keys[1:]):
        if f0 <= f <= f1:
            h = f1 - f0; t = (f - f0) / h
            return (2*t**3 - 3*t**2 + 1) * v0 + (t**3 - 2*t**2 + t) * h * m0 + (-2*t**3 + 3*t**2) * v1 + (t**3 - t**2) * h * m1
    return keys[-1][1]

def catmull_path(pts, s):
    """pts를 지나는 캐트멀-롬 곡선 위의 점. s는 0~len(pts)-1."""
    i = min(int(s), len(pts) - 2); t = s - i
    p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, len(pts) - 1)]
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)

# 1단계의 자리들. 책은 ROOT를 축으로 눕는다: 누운 뒤 앞표지는 위를 보고, 책머리는 +Y를 향한다.
LYING_TOP = -BH / 2 + BT                               # 닫힌 채 누운 책의 윗면 높이
SPREAD_Z = -BH / 2 + BT / 2                            # 펼친 면의 높이
def lying(u, v):
    """241쪽(뒤 절반의 안쪽 면) 위의 점. u: 책등 쪽 0 → 바깥 1, v: 아래 0 → 위 1."""
    return Vector((-BW / 2 + u * BW, YB + BT + v * BH, SPREAD_Z))
Q = lying(0.5, 1 - 610 / 1584)                        # 형광펜을 칠한 인용 두 줄의 가운데(export-book-textures.py의 page-241, 9·10번째 줄)
SPREAD = Vector((-BW / 2, YB + BT + BH / 2, SPREAD_Z))
LYING_C = Vector((0, YB + BT + BH / 2, LYING_TOP))
K1 = Vector((-1.7, YB - 2.3, 1.9))                     # 쓰러지는 책을 왼쪽 앞 위에서 본다
K2 = SPREAD + Vector((0.0, -0.25, 4.1))                # 펼친 면 전체를 위에서 내려다본다(둘레에 바닥이 남는다)
K3 = Q + Vector((0.0, -0.01, 1.25))                    # 인용 두 줄이 화면 폭을 채운다(한 박자 읽힌다)
K4 = Q + Vector((0.0, 0.0, 0.05))                      # 문장 속으로
READ = 214
S_KEYS = [(END0, 0.0, 0.0), (152, 1.0, 0.026), (TOP, 2.0, 0.03), (READ, 3.0, 0.008), (DIVE, 4.0, 0.16)]
E0 = DOOR_C + Vector((0.0, -8.5, 0.25))                # 흰 막이 걷히는 자리: 문 앞(점이 서로 겹쳐 보이는 거리)
F_END = Vector((-0.4, 15.2, -1.3))                     # 0단계 첫 장면 가까이, 문 앞의 사람을 뒤에서

def cam_at(f):
    if f > LAST:
        # 꼬리: 마지막 자리의 시선 그대로 문 쪽으로 다가간다. 시선이 같아 문은 화면의 같은 자리에서 커진다.
        p = F_END + (DOOR_C - F_END).normalized() * PUSH * smooth((f - LAST) / TAIL)
        return p, look(F_END, DOOR_C, LEFT_THIRD * 0.9), 60.0, (DOOR_C - p).length
    if f > DIVE:
        t = 1 - (1 - (f - DIVE - 1) / (LAST - DIVE - 1)) ** 3
        p = E0.lerp(F_END, t)
        q = look(E0, DOOR_C).slerp(look(F_END, DOOR_C, LEFT_THIRD * 0.9), t)
        return p, q, 60.0, (DOOR_C - p).length
    if f > END0:
        p0, q0, _, _ = cam_at(END0)
        d0 = q0 @ Vector((0, 0, -1))
        down = Vector((0, 0.02, -1)).normalized()
        dirs = [d0, (LYING_C - K1).normalized(), Vector((0, 0.05, -1)).normalized(), down, down]
        sv = hermite(f, S_KEYS)
        p = catmull_path([p0, K1, K2, K3, K4], sv)
        q = frame_quat(catmull_path(dirs, sv))
        target = LYING_C if sv < 1.5 else (SPREAD if sv < 2.4 else Q)
        fstop = hermite(f, [(END0, 2.4, 0), (152, 7.0, 0), (TOP, 6.0, 0), (READ, 11.0, 0), (DIVE, 6.0, 0)])
        return p, q, fstop, max(0.08, (target - p).length)
    if f <= ALIGN:
        t = smooth(f / ALIGN)
        # 앞쪽은 빠르게 물러나고 끝에서 천천히 맞춰진다. 곡선은 C0에서 뒤로 빠지며 살짝 떠오른다.
        mid = Vector((0.35, 7.0, -0.15))
        p = (1 - t) ** 2 * C0 + 2 * (1 - t) * t * mid + t * t * Vector((0, 0, 0))
        q = look(C0, DOOR_C).slerp(Quaternion(Vector((1, 0, 0)), math.pi / 2), smooth(f / ALIGN * 1.08))
        return p, q, 60.0, YB
    if f <= TURN[0]:
        return Vector((0, 0, 0)), Quaternion(Vector((1, 0, 0)), math.pi / 2), 60.0, YB
    t = ramp(f, *TURN)
    # 원점에서 책을 중심으로 왼쪽으로 돈다(호). 시선은 책 중심에서 오른쪽으로 비켜 책을 왼쪽에 둔다.
    ang = C2_ANG * t
    dist = YB + BT / 2 + (C2_DIST - YB - BT / 2) * t
    p = BOOK_C + Vector((math.sin(ang) * dist, -math.cos(ang) * dist, 0.22 * t))
    q = look(p, BOOK_C, LEFT_THIRD * t)
    fstop = 60.0 * (1 - t) + 2.4 * t
    return p, q, fstop, (BOOK_C - p).length

prev = None
for f in range(0, LAST + TAIL + 1):
    p, q, fstop, focus = cam_at(f)
    if prev is not None and prev.dot(q) < 0: q = -q
    prev = q
    cam.location = p; cam.rotation_quaternion = q
    cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_quaternion", frame=f)
    cd.dof.aperture_fstop = fstop; cd.dof.focus_distance = focus
    cd.dof.keyframe_insert("aperture_fstop", frame=f); cd.dof.keyframe_insert("focus_distance", frame=f)

# 14번에서 어둠으로 넘어와 밝아진다. 1단계 끝에서는 종이가 하얗게 차고, 그 흰빛이 문의 빛으로 가라앉는다.
for f, e in ((0, -8), (12, 0), (DIVE - 8, 0), (DIVE, 1.6), (DIVE + 1, 1.6), (DIVE + 16, 0)):
    S.view_settings.exposure = e; S.view_settings.keyframe_insert("exposure", frame=f)

# 흰 막: 카메라 바로 앞의 빛 판. 종이 속으로 빨려 들어가며 하얗게 차고, 복도에서 걷힌다(장면이 바뀌는 순간을 가린다).
def build_veil():
    bpy.ops.mesh.primitive_plane_add(size=1.0); ob = bpy.context.object; ob.name = "Veil"
    m, nt, out = (lambda m: (m, *nodes_of(m)))(bpy.data.materials.new("Veil"))
    m.cycles.emission_sampling = "NONE"
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (1.0, 0.98, 0.95, 1); em.inputs["Strength"].default_value = 1.0
    tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(em.outputs[0], mix.inputs[2]); nt.links.new(mix.outputs[0], out.inputs[0])
    key_input(mix.inputs[0], [(0, 0.0), (DIVE - 6, 0.0), (DIVE, 1.0), (DIVE + 2, 1.0), (DIVE + 15, 0.0)])
    ob.data.materials.append(m)
    ob.parent = cam; ob.location = (0, 0, -0.06); ob.scale = (0.2, 0.2, 1)
    ob.visible_shadow = False
    return ob

build_veil()

# ── 렌더 ─────────────────────────────────────────────────────────────
OUT = WORK / ("stills" if A.mode == "still" else "frames")
OUT.mkdir(parents=True, exist_ok=True)
if A.save: bpy.ops.wm.save_as_mainfile(filepath=str(WORK / "book.blend"))
frames = [f for x in A.frames.split(",") if x for f in (range(int(x.split("-")[0]), int(x.split("-")[1]) + 1) if "-" in x else [int(x)])] or list(range(0, LAST + 1))
S.render.motion_blur_shutter = 0.5
for f in frames:
    t0 = time.time(); S.frame_set(f)
    S.render.use_motion_blur = OPEN[0] <= f <= TOP + 4 or READ + 3 <= f <= DIVE   # 낱장이 넘어갈 때와 빨려 들어갈 때만(문장을 읽는 동안은 또렷하게)
    S.render.filepath = str(OUT / f"f{f:04d}.png")
    bpy.ops.render.render(write_still=True)
    print(f"frame {f} {time.time() - t0:.1f}s", flush=True)
