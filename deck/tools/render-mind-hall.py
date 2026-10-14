#!/usr/bin/env python3
"""Keynote 45~48 · 선 안에 있나, 밖에 있나. 어두운 전시관 한 곳을 걷는 한 줄의 카메라.

45 여러분은 어디까지? 홀의 생물에 조명이 하나씩 켜진다(강아지 → 문어 → 벌 → 해파리 → 점균), 마지막에 다섯을 한꺼번에 본다.
46 과학자들이 그은 선: 바닥의 빛 원이 넓어진다(2012 포유류·새·문어 → 2022 영국 법의 문어·게 → 2024 곤충·물고기까지),
   점균과 해파리는 원 밖에 남는다.
47 그럼 AI는? 문턱에 선 AI(파란 점의 뇌) → 문을 지나 복도의 통 속의 뇌(모니터 속 카페) → 접시 위 뇌세포와 퐁.
48 선 바로 밖: 복도 쪽에서 AI를 보면 그 너머 바닥에 빛 원의 가장자리가 멈춰 있다. AI 안쪽에 작은 불이 켜지고, 원은 다시 물러난다.
생물은 덱의 손그림(src/keynote/mind/drawings.ts)을 네온 관으로 세운 빛 조각이다. 선은 tools/export-mind-drawings.mjs가 푼다.
발표자가 멈추는 지점(ANCHORS)에서는 카메라와 빛이 모두 정지해 있다. 덱은 지점 사이를 한 조각씩 재생한다.

  node tools/export-mind-drawings.mjs                                    # 손그림 → render/mind-hall/drawings.json
  blender -b --python tools/render-mind-hall.py -- --mode still --frames 80,160 --scale 50 --samples 32
  blender -b --python tools/render-mind-hall.py -- --mode final          # render/mind-hall/frames/f0000.png …
  tools/encode-mind-hall.sh                                              # public/mind-hall/seg-k.mp4, a-k.jpg
"""
import bpy, bmesh, json, math, sys, argparse, random, time
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "render/mind-hall"
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mode", choices=["still", "final"], default="still")
ap.add_argument("--frames", default="")
ap.add_argument("--samples", type=int, default=0)
ap.add_argument("--scale", type=int, default=0)
ap.add_argument("--save", action="store_true")
A = ap.parse_args(ARGS)
DATA = json.loads((WORK / "drawings.json").read_text())

FPS = 30
# 0은 44번에서 들어오는 어둠, 나머지는 덱의 단계 45-0~5, 46-0~3, 47-0~2, 48-0~2와 1:1이다(src/keynote/mind/hall.json과 같아야 한다).
ANCHORS = [0, 80, 160, 240, 320, 400, 500, 590, 670, 750, 840, 950, 1040, 1120, 1230, 1310, 1390]
LAST = ANCHORS[-1]

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
S.cycles.max_bounces, S.cycles.diffuse_bounces, S.cycles.glossy_bounces = 10, 2, 4
S.cycles.transmission_bounces, S.cycles.transparent_max_bounces = 10, 8
S.cycles.sample_clamp_indirect = 4.0
S.cycles.caustics_reflective = S.cycles.caustics_refractive = False
S.cycles.use_light_tree = True
S.render.resolution_x, S.render.resolution_y = 1920, 1080
S.render.resolution_percentage = A.scale or (100 if A.mode == "final" else 50)
S.render.fps = FPS
S.frame_start, S.frame_end = 0, LAST
S.render.image_settings.file_format = "PNG"
S.view_settings.view_transform = "AgX"
for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
    try: S.view_settings.look = look; break
    except TypeError: pass

W = bpy.data.worlds.new("World"); S.world = W
W.use_nodes = True
W.node_tree.nodes["Background"].inputs[0].default_value = (0.022, 0.016, 0.012, 1)
W.node_tree.nodes["Background"].inputs[1].default_value = 1.0

def link(ob):
    S.collection.objects.link(ob); return ob

# ── 재질 ─────────────────────────────────────────────────────────────
def nodes_of(m):
    m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL": nt.nodes.remove(n)
    return nt, nt.nodes["Material Output"]

def emission(name, color, strength, light=False):
    """light=False: 보이기만 하고 장면을 비추는 광원으로 세지 않는다(네온 관 삼각형 수십만 개가 광원 트리를 무겁게 만든다)."""
    m = bpy.data.materials.new(name); nt, out = nodes_of(m)
    if not light: m.cycles.emission_sampling = "NONE"
    e = nt.nodes.new("ShaderNodeEmission"); e.inputs[0].default_value = (*color, 1); e.inputs[1].default_value = strength
    nt.links.new(e.outputs[0], out.inputs[0]); return m, e

def principled(name, color, rough=0.5, **kw):
    m = bpy.data.materials.new(name); nt, out = nodes_of(m)
    p = nt.nodes.new("ShaderNodeBsdfPrincipled"); p.inputs["Base Color"].default_value = (*color, 1); p.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): p.inputs[k].default_value = v
    nt.links.new(p.outputs[0], out.inputs[0]); return m, p

def glass(name, color=(1, 1, 1), ior=1.5, rough=0.0, absorb=None):
    m = bpy.data.materials.new(name); nt, out = nodes_of(m)
    g = nt.nodes.new("ShaderNodeBsdfGlass"); g.inputs["Color"].default_value = (*color, 1); g.inputs["IOR"].default_value = ior; g.inputs["Roughness"].default_value = rough
    nt.links.new(g.outputs[0], out.inputs["Surface"])
    if absorb:
        v = nt.nodes.new("ShaderNodeVolumeAbsorption"); v.inputs["Color"].default_value = (*absorb[0], 1); v.inputs["Density"].default_value = absorb[1]
        nt.links.new(v.outputs[0], out.inputs["Volume"])
    return m

def key_input(sock, samples):
    for f, v in samples:
        sock.default_value = v; sock.keyframe_insert("default_value", frame=f)

WARM = (1.0, 0.72, 0.42)
CHALK = (1.0, 0.84, 0.62)
ICE = (0.45, 0.76, 1.0)
EMBER = (1.0, 0.45, 0.12)

# ── 바닥 · 기둥 ───────────────────────────────────────────────────────
def floor():
    bpy.ops.mesh.primitive_plane_add(size=90, location=(0, -6, 0)); ob = bpy.context.object; ob.name = "Floor"
    m = bpy.data.materials.new("Floor"); nt, out = nodes_of(m)
    p = nt.nodes.new("ShaderNodeBsdfPrincipled"); p.inputs["Roughness"].default_value = 0.16
    tc = nt.nodes.new("ShaderNodeTexCoord"); br = nt.nodes.new("ShaderNodeTexBrick")
    br.inputs["Scale"].default_value = 0.5; br.inputs["Mortar Size"].default_value = 0.012; br.inputs["Mortar Smooth"].default_value = 0.4
    br.inputs["Color1"].default_value = (0.05, 0.04, 0.032, 1); br.inputs["Color2"].default_value = (0.068, 0.054, 0.042, 1); br.inputs["Mortar"].default_value = (0.006, 0.005, 0.004, 1)
    br.offset, br.squash = 0.0, 1.0
    br.inputs["Brick Width"].default_value = 0.5; br.inputs["Row Height"].default_value = 0.5
    nt.links.new(tc.outputs["Object"], br.inputs["Vector"]); nt.links.new(br.outputs["Color"], p.inputs["Base Color"])
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs[3].default_value = 0.55; mr.inputs[4].default_value = 0.14
    nt.links.new(br.outputs["Fac"], mr.inputs[0]); nt.links.new(mr.outputs[0], p.inputs["Roughness"])
    nt.links.new(p.outputs[0], out.inputs[0]); ob.data.materials.append(m)
floor()
STONE, _ = principled("Stone", (0.085, 0.072, 0.06), 0.42)
METAL, _ = principled("Metal", (0.05, 0.045, 0.04), 0.3, **{"Metallic": 1.0})

def column(x, y, h=6.5, r=0.36):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=r, depth=h, location=(x, y, h / 2)); c = bpy.context.object; c.data.materials.append(STONE)
    for z, rr in ((0.12, r * 1.35), (h - 0.12, r * 1.3)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=rr, depth=0.24, location=(x, y, z)); bpy.context.object.data.materials.append(STONE)

HALL_R = 9.6
for y in (-9.6, -13.0, -16.4, -19.8, -23.2): column(-3.4, y); column(3.4, y)
for i in range(20):
    a = -math.pi / 2 + (i + 0.5) / 20 * 2 * math.pi
    if abs(math.atan2(math.sin(a + math.pi / 2), math.cos(a + math.pi / 2))) < 0.2: continue
    column(HALL_R * math.cos(a), HALL_R * math.sin(a))
# 문턱: 복도가 홀로 들어가는 문. 2024년의 원이 여기까지 닿지 않는다.
DOOR_Y = -6.45
column(-1.75, DOOR_Y, 4.6, 0.3); column(1.75, DOOR_Y, 4.6, 0.3)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, DOOR_Y, 4.75)); lint = bpy.context.object; lint.scale = (4.3, 0.7, 0.3); lint.data.materials.append(STONE)

def pedestal(x, y, h=1.0, w=0.7):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, h / 2)); p = bpy.context.object; p.scale = (w, w, h); p.data.materials.append(STONE)
    bev = p.modifiers.new("b", "BEVEL"); bev.width = 0.015; bev.segments = 2
    return h

# ── 빛 조각(네온 관) ─────────────────────────────────────────────────
def neon(name, key, height, loc, face=None, strength=5.0, color=CHALK, bevel=0.0065, only=None):
    d = DATA[key]; vw, vh = d["vw"], d["vh"]; s = height / vh
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = bevel; cu.bevel_resolution = 3; cu.use_fill_caps = True
    for i, poly in enumerate(d["polys"]):
        if only is not None and i not in only: continue
        sp = cu.splines.new("POLY"); sp.points.add(len(poly) - 1)
        for j, (x, y) in enumerate(poly): sp.points[j].co = ((x - vw / 2) * s, 0, (vh - y) * s, 1)
    ob = link(bpy.data.objects.new(name, cu)); ob.location = loc
    if face is not None:
        vx, vy = face[0] - loc[0], face[1] - loc[1]; ob.rotation_euler = (0, 0, math.atan2(vx, -vy))
    m, e = emission(name, color, strength); cu.materials.append(m)
    return ob, e

def sock_ramp(sock, f0, f1, v0, v1):
    key_input(sock, [(f0, v0), (f1, v1)])

# ── 47-1 · 통 속의 뇌 ────────────────────────────────────────────────
VAT = Vector((-1.45, -11.7, 0))
ph = pedestal(VAT.x, VAT.y, 1.0, 0.86)
def cyl(name, r, h, z, mat, verts=96, solid=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=(VAT.x, VAT.y, z)); o = bpy.context.object; o.name = name; o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    if solid: s = o.modifiers.new("s", "SOLIDIFY"); s.thickness = solid; s.offset = -1
    return o
cyl("VatBase", 0.38, 0.08, ph + 0.04, METAL)
cyl("VatGlass", 0.34, 0.92, ph + 0.08 + 0.46, glass("VatGlass", ior=1.5), solid=0.012)
cyl("VatLiquid", 0.325, 0.78, ph + 0.08 + 0.39, glass("Liquid", (0.98, 0.9, 0.74), 1.33))
cyl("VatLid", 0.36, 0.05, ph + 0.08 + 0.92 + 0.025, METAL)

def brain_mesh(name, at, size, mat, displace=True):
    parts = []
    for side in (-1, 1):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6, radius=1, location=(at.x, at.y + side * size * 0.27, at.z))
        h = bpy.context.object; h.scale = (size * 1.18, size * 0.5, size * 0.78); parts.append(h)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1, location=(at.x - size * 0.72, at.y, at.z - size * 0.5))
    cb = bpy.context.object; cb.scale = (size * 0.42, size * 0.62, size * 0.3); parts.append(cb)
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.join(); b = bpy.context.object; b.name = name
    if displace:
        tex = bpy.data.textures.new(name + "Folds", "VORONOI"); tex.noise_scale = size * 0.42; tex.distance_metric = "DISTANCE"
        tex.color_mode = "INTENSITY"; tex.noise_intensity = 1.0; tex.weight_1, tex.weight_2 = -1.0, 1.0
        dm = b.modifiers.new("folds", "DISPLACE"); dm.texture = tex; dm.strength = size * 0.16; dm.texture_coords = "LOCAL"
    bpy.ops.object.shade_smooth(); b.data.materials.append(mat)
    return b

bm = bpy.data.materials.new("BrainVat"); nt, out = nodes_of(bm)
p = nt.nodes.new("ShaderNodeBsdfPrincipled"); p.inputs["Base Color"].default_value = (0.86, 0.62, 0.55, 1); p.inputs["Roughness"].default_value = 0.38
p.inputs["Subsurface Weight"].default_value = 0.35; p.inputs["Subsurface Radius"].default_value = (0.3, 0.12, 0.08)
wv = nt.nodes.new("ShaderNodeTexWave"); wv.inputs["Scale"].default_value = 7.0; wv.inputs["Distortion"].default_value = 9.0; wv.inputs["Detail"].default_value = 3.0
tc = nt.nodes.new("ShaderNodeTexCoord"); nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
cr = nt.nodes.new("ShaderNodeValToRGB"); cr.color_ramp.elements[0].position = 0.92; cr.color_ramp.elements[1].position = 0.985
cr.color_ramp.elements[0].color = (0, 0, 0, 1); cr.color_ramp.elements[1].color = (1, 1, 1, 1)
nt.links.new(wv.outputs["Fac"], cr.inputs[0])
p.inputs["Emission Color"].default_value = (1.0, 0.62, 0.3, 1)
nt.links.new(cr.outputs[0], p.inputs["Emission Strength"])
mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = 0.0
BRAIN_GLOW = mul.inputs[1]
nt.links.new(cr.outputs[0], mul.inputs[0]); nt.links.new(mul.outputs[0], p.inputs["Emission Strength"])
nt.links.new(p.outputs[0], out.inputs[0])
BRAIN_AT = Vector((VAT.x, VAT.y, ph + 0.08 + 0.42))
brain_mesh("VatBrain", BRAIN_AT, 0.14, bm)
# 거품: 통 안에서 떠오른다. 통이 보이는 구간(940~1130)만 프레임마다 굽는다.
BUB = glass("Bubble", ior=1.1)
rnd = random.Random(7)
for i in range(26):
    r = rnd.uniform(0.006, 0.014)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=12, ring_count=8, location=(VAT.x + rnd.uniform(-0.24, 0.24), VAT.y + rnd.uniform(-0.24, 0.24), 0))
    b = bpy.context.object; b.data.materials.append(BUB)
    z0, hgt, speed, off = ph + 0.12, 0.62, rnd.uniform(0.004, 0.008), rnd.uniform(0, 1)
    for f in range(940, 1132, 2):
        b.location.z = z0 + ((f * speed + off) % 1.0) * hgt; b.keyframe_insert("location", index=2, frame=f)
# 뇌와 모니터를 잇는 선, 그리고 그 뇌가 겪는 가짜 세상(카페)
MON = Vector((VAT.x - 1.05, VAT.y - 0.15, 0)); MON_FACE = (-3.6, -15.6)
yaw = math.atan2(MON_FACE[0] - MON.x, -(MON_FACE[1] - MON.y))
from mathutils import Matrix
rot = Matrix.Rotation(yaw, 4, "Z")
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.03, depth=1.0, location=(MON.x, MON.y, 0.5)); bpy.context.object.data.materials.append(METAL)
bpy.ops.mesh.primitive_cube_add(size=1, location=(MON.x, MON.y, 1.24)); mon = bpy.context.object; mon.scale = (0.62, 0.05, 0.42); mon.rotation_euler = (0, 0, yaw); mon.data.materials.append(METAL)
scr_m, scr_e = emission("Screen", (0.12, 0.16, 0.22), 0.8)
bpy.ops.mesh.primitive_plane_add(size=1, location=Vector((MON.x, MON.y, 1.24)) + rot @ Vector((0, -0.027, 0))); scr = bpy.context.object
scr.scale = (0.56, 0.36, 1); scr.rotation_euler = (math.pi / 2, 0, yaw); scr.data.materials.append(scr_m)
cafe_ob, cafe_e = neon("Cafe", "CUP", 0.26, tuple(Vector((MON.x, MON.y, 1.24 - 0.13)) + rot @ Vector((0, -0.035, 0))), face=MON_FACE, strength=4.0, color=WARM, bevel=0.0035)
def cable(name, pts, r=0.009):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = r; cu.bevel_resolution = 3
    sp = cu.splines.new("NURBS"); sp.points.add(len(pts) - 1); sp.use_endpoint_u = True; sp.order_u = 4
    for i, q in enumerate(pts): sp.points[i].co = (*q, 1)
    ob = link(bpy.data.objects.new(name, cu)); m, _ = principled(name, (0.02, 0.018, 0.016), 0.25); cu.materials.append(m)
for k, dx in enumerate((-0.03, 0.03)):
    cable(f"Cable{k}", [(BRAIN_AT.x + dx, BRAIN_AT.y, BRAIN_AT.z - 0.12), (BRAIN_AT.x + dx, BRAIN_AT.y, ph + 0.12), (VAT.x - 0.36 + dx, VAT.y - 0.05, ph + 0.05), (VAT.x - 0.6, VAT.y - 0.1 + dx, 0.55), (MON.x + 0.1, MON.y + dx, 0.03), (MON.x, MON.y, 0.02)])
vat_spot = bpy.data.lights.new("VatSpot", "SPOT"); vat_spot.energy = 140; vat_spot.color = WARM; vat_spot.spot_size = math.radians(34); vat_spot.spot_blend = 0.8; vat_spot.shadow_soft_size = 0.4
o = link(bpy.data.objects.new("VatSpot", vat_spot)); o.location = (VAT.x, VAT.y, 4.2)

# ── 47-2 · 사고실험이 아니다: 접시 위의 뇌세포와 퐁 ─────────────────────
# 2022 DishBrain(뇌세포 약 80만 개가 퐁을 배움), 2025 CL1(뇌세포 컴퓨터), 2024 MetaBOC(뇌세포 칩이 로봇을 움직임). 접시와 세포는 도식이다.
DISH = Vector((VAT.x - 0.5, VAT.y - 0.82, 0))
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.035, depth=1.0, location=(DISH.x, DISH.y, 0.5)); bpy.context.object.data.materials.append(METAL)
bpy.ops.mesh.primitive_cube_add(size=1, location=(DISH.x, DISH.y, 1.012)); chip = bpy.context.object; chip.scale = (0.3, 0.3, 0.024); chip.data.materials.append(METAL)
GOLDM, _ = principled("Contacts", (0.9, 0.68, 0.3), 0.25, **{"Metallic": 1.0})
for k in range(9):
    for sgn in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(DISH.x + (k - 4) * 0.03, DISH.y + sgn * 0.135, 1.026)); c = bpy.context.object; c.scale = (0.012, 0.03, 0.004); c.data.materials.append(GOLDM)
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.105, depth=0.03, location=(DISH.x, DISH.y, 1.04)); dish = bpy.context.object; dish.data.materials.append(glass("Dish", ior=1.45))
mod = dish.modifiers.new("s", "SOLIDIFY"); mod.thickness = 0.004
cells_m, cells_e = emission("Cells", (1.0, 0.66, 0.38), 0.0)
cmesh = bpy.data.meshes.new("Cells"); cb = bmesh.new(); rc = random.Random(5); pts = []
for i in range(220):
    a, r = rc.uniform(0, 2 * math.pi), 0.09 * math.sqrt(rc.random()); q = Vector((math.cos(a) * r, math.sin(a) * r, 0)); pts.append(q)
    bmesh.ops.create_icosphere(cb, subdivisions=1, radius=0.0022, matrix=Matrix.Translation(q), calc_uvs=False)
cb.to_mesh(cmesh); cb.free()
cells = link(bpy.data.objects.new("Cells", cmesh)); cells.location = (DISH.x, DISH.y, 1.032); cmesh.materials.append(cells_m)
cu = bpy.data.curves.new("Neurites", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.0005
for i, q in enumerate(pts):
    near = sorted(pts, key=lambda o: (o - q).length)[1:3]
    for o in near:
        sp = cu.splines.new("POLY"); sp.points.add(1); sp.points[0].co = (*q, 1); sp.points[1].co = (*o, 1)
neur = link(bpy.data.objects.new("Neurites", cu)); neur.location = cells.location; cu.materials.append(cells_m)
key_input(cells_e.inputs[1], [(0, 0.0), (1050, 0.0), (1095, 3.5)])
# 모니터: 카페(사고실험 속 가짜 세상)가 꺼지고 퐁이 켜진다
key_input(cafe_e.inputs[1], [(0, 4.0), (1050, 4.0), (1066, 0.0)])
# 꺼진 네온 관은 밝은 화면 앞에서 검은 선으로 남는다. 꺼진 뒤에는 숨긴다.
cafe_ob.hide_render = False; cafe_ob.keyframe_insert("hide_render", frame=1066); cafe_ob.hide_render = True; cafe_ob.keyframe_insert("hide_render", frame=1068)
key_input(scr_e.inputs[1], [(0, 0.8), (1052, 0.8), (1070, 0.12)])
pong_m, pong_e = emission("Pong", (0.92, 0.96, 1.0), 0.0)
key_input(pong_e.inputs[1], [(0, 0.0), (1062, 0.0), (1076, 5.0)])
SCR = Vector((MON.x, MON.y, 1.24)) + rot @ Vector((0, -0.036, 0))
def on_screen(u, v): return SCR + rot @ Vector((u, 0, 0)) + Vector((0, 0, v))
def box(name, u, v, w, h):
    bpy.ops.mesh.primitive_cube_add(size=1, location=on_screen(u, v)); b = bpy.context.object; b.name = name; b.scale = (w, 0.004, h); b.rotation_euler = (0, 0, yaw); b.data.materials.append(pong_m); return b
for k in range(7): box(f"Net{k}", 0.0, -0.15 + k * 0.05, 0.006, 0.022)
padL, padR, ball = box("PadL", -0.24, 0, 0.012, 0.08), box("PadR", 0.24, 0, 0.012, 0.08), box("Ball", 0, 0, 0.018, 0.018)
for ob in [o for o in S.collection.objects if o.name.startswith(("Net", "Pad", "Ball"))]:
    # 꺼진 퐁은 밝은 카페 화면 앞에서 검은 막대로 보인다. 켜지기 전에는 숨긴다.
    ob.hide_render = True; ob.keyframe_insert("hide_render", frame=1060); ob.hide_render = False; ob.keyframe_insert("hide_render", frame=1062)
for f in range(1062, 1122, 2):
    # 공은 좌우 벽 사이를 오가고, 두 막대가 공의 높이를 따라간다
    t = (f - 1062) / 58.0; bv = 0.12 * math.sin(t * 7.0)
    ball.location = on_screen(0.42 * abs(((t * 1.5) % 2) - 1) - 0.21, bv); ball.keyframe_insert("location", frame=f)
    padL.location = on_screen(-0.24, bv * 0.8); padL.keyframe_insert("location", frame=f)
    padR.location = on_screen(0.24, bv * 0.7); padR.keyframe_insert("location", frame=f)
cable("DishCable", [(DISH.x - 0.08, DISH.y + 0.1, 1.03), (DISH.x - 0.2, DISH.y + 0.3, 0.9), (MON.x + 0.15, MON.y - 0.1, 1.0), (MON.x + 0.05, MON.y, 1.1)], 0.004)
dsp = bpy.data.lights.new("DishSpot", "SPOT"); dsp.color = WARM; dsp.spot_size = math.radians(24); dsp.spot_blend = 0.8; dsp.shadow_soft_size = 0.2
o = link(bpy.data.objects.new("DishSpot", dsp)); o.location = (DISH.x, DISH.y, 3.2)
dsp.energy = 0; dsp.keyframe_insert("energy", frame=1046); dsp.energy = 70; dsp.keyframe_insert("energy", frame=1090)

# ── 47-0 · 문턱의 AI: 파란 점으로 된 뇌 ────────────────────────────────
AI = Vector((0.0, -7.05, 0))
ah = pedestal(AI.x, AI.y, 1.0, 0.62)
AI_AT = Vector((AI.x, AI.y, ah + 0.42))
dot_m, dot_e = emission("AIDots", (0.22, 0.58, 1.0), 1.3)
mesh = bpy.data.meshes.new("AIBrain"); bmx = bmesh.new(); rr = random.Random(11)
def inside(p):
    q1 = ((p.x) / 1.18) ** 2 + ((p.y - 0.27) / 0.5) ** 2 + (p.z / 0.78) ** 2
    q2 = ((p.x) / 1.18) ** 2 + ((p.y + 0.27) / 0.5) ** 2 + (p.z / 0.78) ** 2
    q3 = ((p.x + 0.72) / 0.42) ** 2 + (p.y / 0.62) ** 2 + ((p.z + 0.5) / 0.3) ** 2
    return min(q1, q2, q3)
n = 0
while n < 3400:
    p = Vector((rr.uniform(-1.3, 1.3), rr.uniform(-0.85, 0.85), rr.uniform(-0.85, 0.85)))
    q = inside(p)
    if q > 1 or rr.random() > 0.25 + 0.75 * q ** 1.5: continue
    s = 0.003 + rr.random() * 0.0028
    bmesh.ops.create_icosphere(bmx, subdivisions=1, radius=s / 0.2, matrix=Matrix.Translation(p), calc_uvs=False)
    n += 1
bmx.to_mesh(mesh); bmx.free()
ai = link(bpy.data.objects.new("AIBrain", mesh)); ai.location = AI_AT; ai.scale = (0.2, 0.2, 0.2); mesh.materials.append(dot_m)
core_m, core_e = emission("AICore", EMBER, 0.0)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.05, location=AI_AT); core = bpy.context.object; core.data.materials.append(core_m)
ai_spot = bpy.data.lights.new("AISpot", "SPOT"); ai_spot.energy = 90; ai_spot.color = ICE; ai_spot.spot_size = math.radians(30); ai_spot.spot_blend = 0.85; ai_spot.shadow_soft_size = 0.4
o = link(bpy.data.objects.new("AISpot", ai_spot)); o.location = (AI.x, AI.y, 4.0)

# ── 45 · 여러분은 어디까지? / 46 · 넓어지는 빛 원 ─────────────────────
# 생물은 모두 원 전경 카메라(VIEW) 쪽을 본다. 45번의 가까운 샷도 같은 쪽에서 찍어, 생물을 돌리지 않아도 늘 정면이 보인다.
VIEW = (9.6, -7.0)
# (이름, 그림, 높이, 위치, 공중 높이)
BEINGS = [
    ("Dog", "DOG", 1.35, (-1.3, 1.25), 0.0), ("Bird", "BIRD", 0.85, (1.75, 1.35), 0.0), ("Octopus", "OCTOPUS", 1.3, (-1.95, -1.0), 0.0),
    ("Crab", "CRAB", 0.8, (3.55, -1.25), 0.0),
    ("Fish", "FISH", 0.72, (-3.1, 3.75), 0.9), ("Bee", "BEE", 0.65, (4.1, 3.05), 1.1),
    ("Slime", "SLIME", 0.6, (-5.9, -3.9), 0.0), ("Jelly", "JELLY", 1.3, (5.7, -4.6), 1.2),
]
# 45번: 조명이 켜지는 차례와 그 정지 지점
LADDER = {"Dog": 80, "Octopus": 160, "Bee": 240, "Jelly": 320, "Slime": 400}
def closeup(x, y, lift, h):
    """생물에서 VIEW 쪽으로 물러난 눈과 생물의 가운데"""
    dx, dy = VIEW[0] - x, VIEW[1] - y; n = math.hypot(dx, dy); d = 2.2 + h * 1.2; cz = lift + h * 0.5
    return (x + dx / n * d, y + dy / n * d, cz + 0.25), (x, y, cz)
def R(f):
    """빛 원의 반지름(m). 정지 지점마다 멈춘다."""
    def seg(f, f0, f1, a, b):
        t = max(0.0, min(1.0, (f - f0) / (f1 - f0))); t = t * t * (3 - 2 * t); return a + (b - a) * t
    if f < 525: return 0.0
    if f <= 590: return seg(f, 525, 588, 0.0, 3.2)     # 46-0 · 2012
    if f <= 670: return seg(f, 602, 668, 3.2, 4.4)     # 46-1 · 2022
    if f <= 750: return seg(f, 682, 748, 4.4, 6.0)     # 46-2 · 2024
    if f <= 1310: return seg(f, 1240, 1305, 6.0, 6.18)  # 48-1 · 가장자리가 AI 쪽으로 조금 다가온다
    return seg(f, 1320, 1385, 6.18, 6.02)              # 48-2 · 다시 물러나 멈춘다
being_e = []
for name, key, h, (x, y), lift in BEINGS:
    _, e = neon(name, key, h, (x, y, lift), face=VIEW, strength=0.2, bevel=0.009)
    keys = [(0, 0.2)]
    if name in LADDER:
        # 45번: 그 차례가 오면 위에서 조명이 켜지고 관이 밝아진다. 46번으로 넘어가며 모두 같은 밝기로 돌아간다.
        at = LADDER[name]; keys += [(at - 52, 0.2), (at - 14, 3.0), (500, 3.0)]
        sp_ = bpy.data.lights.new(f"Spot{name}", "SPOT"); sp_.color = WARM; sp_.spot_size = math.radians(30); sp_.spot_blend = 0.75; sp_.shadow_soft_size = 0.3
        o = link(bpy.data.objects.new(sp_.name, sp_)); o.location = (x, y, lift + h + 3.4)
        for f, v in ((0, 0), (at - 52, 0), (at - 14, 260), (500, 260), (520, 0)): sp_.energy = v; sp_.keyframe_insert("energy", frame=f)
    else:
        keys += [(500, 0.2)]
    keys += [(520, 0.45)]
    r = math.hypot(x, y)
    cross = next((f for f in range(520, LAST + 1) if R(f) >= r), None)
    if cross is not None: keys += [(cross - 2, 0.45), (cross + 10, 6.5)]
    key_input(e.inputs[1], sorted(keys))
    being_e.append(e)
ring_m, ring_e = emission("Ring", WARM, 14.0, light=True)
bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.0036, major_segments=256, minor_segments=10, location=(0, 0, 0.01)); ring = bpy.context.object; ring.data.materials.append(ring_m)
wash = bpy.data.materials.new("Wash"); nt, out = nodes_of(wash)
tc = nt.nodes.new("ShaderNodeTexCoord"); gr = nt.nodes.new("ShaderNodeTexGradient"); gr.gradient_type = "SPHERICAL"
nt.links.new(tc.outputs["Object"], gr.inputs["Vector"])
cr = nt.nodes.new("ShaderNodeValToRGB"); cr.color_ramp.elements[0].position = 0.0; cr.color_ramp.elements[1].position = 0.32
cr.color_ramp.elements[0].color = (0, 0, 0, 1); cr.color_ramp.elements[1].color = (0.55, 0.55, 0.55, 1)
nt.links.new(gr.outputs["Fac"], cr.inputs[0])
em = nt.nodes.new("ShaderNodeEmission"); em.inputs[0].default_value = (*WARM, 1); em.inputs[1].default_value = 0.32
tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mx = nt.nodes.new("ShaderNodeMixShader")
nt.links.new(cr.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs[0])
bpy.ops.mesh.primitive_circle_add(vertices=128, radius=1.0, fill_type="NGON", location=(0, 0, 0.004)); disc = bpy.context.object; disc.data.materials.append(wash)
for f in range(515, LAST + 1):
    r = max(R(f), 0.001)
    for ob in (ring, disc): ob.scale = (r, r, 1); ob.keyframe_insert("scale", frame=f)
key_input(ring_e.inputs[1], [(0, 0.0), (522, 0.0), (534, 14.0)])
hall = bpy.data.lights.new("HallTop", "AREA"); hall.energy = 600; hall.color = WARM; hall.size = 9
o = link(bpy.data.objects.new("HallTop", hall)); o.location = (0, 0, 9)
hall.energy = 300; hall.keyframe_insert("energy", frame=0); hall.keyframe_insert("energy", frame=505); hall.energy = 950; hall.keyframe_insert("energy", frame=590)
# 48-1 · AI 안쪽의 불(절박함): 겉의 파랑은 그대로다
key_input(core_e.inputs[1], [(0, 0.0), (1240, 0.0), (1292, 3.2), (1310, 2.6)])
# 들어오는 어둠(0 → 80)
S.view_settings.exposure = -6; S.view_settings.keyframe_insert("exposure", frame=0)
S.view_settings.exposure = 1.3; S.view_settings.keyframe_insert("exposure", frame=46)

# ── 차례로 드러나기: 통과 AI는 47번에서 켜진다 ─────────────────────────
key_input(BRAIN_GLOW, [(0, 0.0), (960, 0.0), (1010, 0.9)])
vat_spot.energy = 0; vat_spot.keyframe_insert("energy", frame=956); vat_spot.energy = 260; vat_spot.keyframe_insert("energy", frame=1006)
# 통 안의 작은 불: 뇌가 스스로 빛나는 표본처럼 보인다(뒤에서 비추면 액체가 렌즈가 되어 하얀 원이 생겼다)
rim = bpy.data.lights.new("VatGlow", "POINT"); rim.shadow_soft_size = 0.05; rim.color = (1.0, 0.7, 0.45)
o = link(bpy.data.objects.new("VatGlow", rim)); o.location = (BRAIN_AT.x - 0.06, BRAIN_AT.y - 0.16, BRAIN_AT.z + 0.1); o.visible_camera = False; o.visible_glossy = False; o.visible_transmission = False
rim.energy = 0; rim.keyframe_insert("energy", frame=956); rim.energy = 6; rim.keyframe_insert("energy", frame=1006)
key_input(dot_e.inputs[1], [(0, 0.0), (852, 0.0), (908, 1.3)])
ai_spot.energy = 0; ai_spot.keyframe_insert("energy", frame=852); ai_spot.energy = 90; ai_spot.keyframe_insert("energy", frame=908)
# 홀 안쪽의 따뜻한 빛: 기둥이 실루엣으로 선다(부피 안개 대신 빛나는 먼 벽)
bg_m = bpy.data.materials.new("BackGlow"); nt, out = nodes_of(bg_m); bg_m.cycles.emission_sampling = "NONE"
tc = nt.nodes.new("ShaderNodeTexCoord"); gr = nt.nodes.new("ShaderNodeTexGradient"); gr.gradient_type = "SPHERICAL"
nt.links.new(tc.outputs["Object"], gr.inputs["Vector"])
em = nt.nodes.new("ShaderNodeEmission"); em.inputs[0].default_value = (0.9, 0.55, 0.28, 1)
pw_ = nt.nodes.new("ShaderNodeMath"); pw_.operation = "POWER"; pw_.inputs[1].default_value = 2.2
nt.links.new(gr.outputs["Fac"], pw_.inputs[0]); mul2 = nt.nodes.new("ShaderNodeMath"); mul2.operation = "MULTIPLY"; mul2.inputs[1].default_value = 0.55
nt.links.new(pw_.outputs[0], mul2.inputs[0]); nt.links.new(mul2.outputs[0], em.inputs[1]); nt.links.new(em.outputs[0], out.inputs[0])
for (loc, rz, sz) in (((0, HALL_R + 4.5, 3.0), 0, (16, 7)), ((0, -29, 3.0), math.pi, (9, 5))):
    bpy.ops.mesh.primitive_plane_add(size=2, location=loc); g = bpy.context.object; g.scale = (sz[0], sz[1], 1); g.rotation_euler = (math.pi / 2, 0, rz); g.data.materials.append(bg_m)

# 복도 천장의 따뜻한 채움빛: 기둥과 바닥이 어둠에 묻히지 않게 한다(2026-10-14 리뷰 "너무 어둡다")
for y in (-9.5, -13.5, -17.5, -21.5):
    fl = bpy.data.lights.new(f"Fill{y}", "AREA"); fl.energy = 160; fl.color = WARM; fl.size = 4.5
    o = link(bpy.data.objects.new(fl.name, fl)); o.location = (0, y, 6.2)

# ── 카메라 ───────────────────────────────────────────────────────────
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 32; cam_d.clip_end = 200; cam_d.sensor_width = 36
cam = link(bpy.data.objects.new("Cam", cam_d)); S.camera = cam
look = link(bpy.data.objects.new("Look", None))
tt = cam.constraints.new("TRACK_TO"); tt.target = look; tt.track_axis = "TRACK_NEGATIVE_Z"; tt.up_axis = "UP_Y"
def aim(eye, subject, sx=0.66, sy=0.5):
    """subject가 화면의 (sx, sy)에 오도록 바라볼 점을 정한다(글 단은 왼쪽)."""
    eye, subject = Vector(eye), Vector(subject)
    fwd = (subject - eye).normalized(); right = fwd.cross(Vector((0, 0, 1))).normalized(); up = right.cross(fwd)
    dist = (subject - eye).length; half_w = math.tan(math.atan(18 / 32)) * dist; half_h = half_w * 9 / 16
    return subject - right * (sx - 0.5) * 2 * half_w + up * (sy - 0.5) * 2 * half_h
CLOSE = {name: closeup(x, y, lift, h) for name, _, h, (x, y), lift in BEINGS}
SHOTS = [  # (프레임, 눈, 피사체, 화면 x, 화면 y). 정지 지점이 아닌 키(None 표시)는 지나가는 길목이다.
    (0, (0.0, -8.7, 1.6), CLOSE["Dog"][1], 0.62, 0.5),
    *[(at, *CLOSE[name], 0.66, 0.5) for name, at in LADDER.items()],
    # 원 전경은 기둥 줄(반지름 9.6) 안쪽에서 찍는다. 바깥에서는 기둥이 화면 가운데를 가렸다.
    (500, (10.6, -9.4, 14.8), (0.6, -0.9, 0.5), 0.58, 0.5),
    (590, (6.0, -5.6, 6.2), (0, 0.4, 0.3), 0.6, 0.52),
    (670, (6.5, -5.0, 7.4), (1.5, -0.7, 0.2), 0.58, 0.5),
    (750, (7.2, -3.4, 10.6), (0, 0.1, 0.0), 0.6, 0.5),
    (840, (-2.45, -1.25, 1.35), (-5.9, -3.9, 0.3), 0.64, 0.5),
    (950, (0.95, -3.3, 1.35), (AI.x, AI.y, 1.38), 0.64, 0.45),
    (995, (-0.95, -7.0, 1.65), (VAT.x, VAT.y, 1.42), 0.6, 0.5, None),
    (1040, (-3.5, -15.3, 1.62), (VAT.x, VAT.y, 1.42), 0.64, 0.5),
    (1120, (-1.55, -13.75, 1.36), (DISH.x - 0.32, DISH.y + 0.38, 1.12), 0.62, 0.5),
    (1230, (1.1, -10.7, 1.25), (AI.x, AI.y, 1.3), 0.62, 0.5),
    (1310, (0.8, -9.8, 1.18), (AI.x, AI.y, 1.3), 0.62, 0.5),
    (1390, (0.5, -9.1, 1.1), (AI.x, AI.y, 1.3), 0.62, 0.5),
]
for f, eye, subj, sx, sy, *_ in SHOTS:
    cam.location = eye; cam.keyframe_insert("location", frame=f)
    look.location = aim(eye, subj, sx, sy); look.keyframe_insert("location", frame=f)
# 정지 지점에서는 카메라가 완전히 멈추도록 그 키의 손잡이를 평평하게 둔다(길목 키는 부드럽게 지나간다).
def fcurves(ob):
    act = ob.animation_data.action
    try: return list(act.fcurves)
    except AttributeError:
        from bpy_extras.anim_utils import action_get_channelbag_for_slot
        return list(action_get_channelbag_for_slot(act, ob.animation_data.action_slot).fcurves)
for ob in (cam, look):
    for fc in fcurves(ob):
        kps = list(fc.keyframe_points)
        for i, kp in enumerate(kps):
            if round(kp.co.x) not in ANCHORS: continue
            left = (kp.co.x - kps[i - 1].co.x) / 3 if i else 10; right = (kps[i + 1].co.x - kp.co.x) / 3 if i + 1 < len(kps) else 10
            kp.handle_left_type = kp.handle_right_type = "FREE"
            kp.handle_left = (kp.co.x - left, kp.co.y); kp.handle_right = (kp.co.x + right, kp.co.y)
        fc.update()

# ── 렌더 ─────────────────────────────────────────────────────────────
if A.save: bpy.ops.wm.save_as_mainfile(filepath=str(WORK / "mind-hall.blend"))
def parse_frames(spec):
    """"80,160" 또는 "590-750"처럼 적는다."""
    out = []
    for part in spec.split(","):
        if "-" in part: a, b = part.split("-"); out += list(range(int(a), int(b) + 1))
        elif part: out.append(int(part))
    return out
frames = parse_frames(A.frames) if A.frames else (list(range(0, LAST + 1)) if A.mode == "final" else ANCHORS[1:])
outdir = WORK / ("frames" if A.mode == "final" else "stills"); outdir.mkdir(parents=True, exist_ok=True)
for f in frames:
    S.frame_set(f); S.render.filepath = str(outdir / f"f{f:04d}.png"); t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"frame {f} {time.time() - t0:.1f}s", flush=True)
