"""
31·32·34번(악용 서사)의 무대: 한밤중 협탁 위에 놓인 휴대전화.
화면은 어둡게 렌더하고, 실제 화면 내용(수신 전화·메시지)은 덱의 DOM이 화면의 네 모서리에 맞춰 덮는다.

Run with Blender 5+:
  blender -b --python deck/tools/render-night-phone.py -- --mode sample   # 960x540, 빠른 구도 확인
  blender -b --python deck/tools/render-night-phone.py -- --mode final    # 2880x1620 (1.5배)
결과: public/abuse/night-phone.jpg, public/abuse/night-phone.json(화면 네 모서리, 화면 px)
"""
import bpy, bmesh, math, json, sys, argparse, subprocess
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/abuse'
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
p = argparse.ArgumentParser()
p.add_argument('--mode', choices=['sample', 'final'], default='sample')
p.add_argument('--samples', type=int, default=96)
a = p.parse_args(ARGS)

# 최종본은 1.5배로 렌더한다. 덱은 1920×1080으로 표시하고, 통화 장면에서 휴대전화 쪽으로 다가가도 선명하게.
W, H = (960, 540) if a.mode == 'sample' else (2880, 1620)
PHONE = dict(w=0.0716, h=0.1475, d=0.0079, r=0.0098, bezel=0.0033, sr=0.0088)
PHONE_POS = Vector((0.0, 0.0, 0.0))
PHONE_ROT = math.radians(-6.5)


def material(name, color, metal=0.0, rough=0.5, emission=None, strength=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if coat and 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = .18
    if emission:
        b.inputs['Emission Color'].default_value = (*emission, 1); b.inputs['Emission Strength'].default_value = strength
    return m


def walnut():
    m = bpy.data.materials.new('Night walnut'); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.0, 9.0, 1.0)
    wave = nt.nodes.new('ShaderNodeTexWave'); wave.inputs['Scale'].default_value = 3.2; wave.inputs['Distortion'].default_value = 6.0; wave.inputs['Detail'].default_value = 3.0
    noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 60.0
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'FLOAT'; mix.inputs[0].default_value = .25
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (.018, .009, .005, 1); ramp.color_ramp.elements[1].color = (.075, .04, .022, 1)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], wave.inputs['Vector'])
    nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
    nt.links.new(wave.outputs['Fac'], mix.inputs[2]); nt.links.new(noise.outputs['Fac'], mix.inputs[3])
    nt.links.new(mix.outputs[0], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = .36
    if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value = .35; b.inputs['Coat Roughness'].default_value = .22
    return m


def rounded_slab(name, w, h, d, r, mat, edge=0.0):
    """가로 w, 세로 h, 두께 d, 모서리 반경 r의 판. edge가 있으면 윗·아랫면 둘레도 조금 굴린다."""
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((w, h, d)), verts=bm.verts)
    vertical = [e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).normalized().z) > .9]
    bmesh.ops.bevel(bm, geom=vertical, offset=r, segments=14, affect='EDGES', profile=.5)
    if edge:
        rim = [e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).normalized().z) < .1 and len(e.link_faces) == 2 and any(abs(f.normal.z) > .9 for f in e.link_faces)]
        bmesh.ops.bevel(bm, geom=rim, offset=edge, segments=4, affect='EDGES', profile=.5)
    bm.to_mesh(me); bm.free()
    for poly in me.polygons: poly.use_smooth = True
    ob.data.materials.append(mat)
    return ob


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True); s = bpy.context.scene
    s.render.engine = 'BLENDER_EEVEE'
    s.render.resolution_x, s.render.resolution_y, s.render.resolution_percentage = W, H, 100
    s.render.image_settings.file_format = 'PNG'; s.render.image_settings.color_mode = 'RGB'
    if hasattr(s, 'eevee'):
        s.eevee.taa_render_samples = a.samples if a.mode == 'final' else 24
        if hasattr(s.eevee, 'use_raytracing'): s.eevee.use_raytracing = True
        if hasattr(s.eevee, 'use_shadows'): s.eevee.use_shadows = True
    s.world = bpy.data.worlds.new('Night room'); s.world.use_nodes = True
    bg = s.world.node_tree.nodes['Background']; bg.inputs[0].default_value = (.004, .006, .011, 1); bg.inputs[1].default_value = 1.0
    s.view_settings.view_transform = 'AgX'; s.view_settings.look = 'AgX - Medium High Contrast'; s.view_settings.exposure = .1
    try:
        tree = bpy.data.node_groups.new('Screen halation', 'CompositorNodeTree')
        tree.interface.new_socket(name='Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        s.compositing_node_group = tree
        rl = tree.nodes.new('CompositorNodeRLayers'); gl = tree.nodes.new('CompositorNodeGlare')
        gl.inputs['Type'].default_value = 'Fog Glow'; gl.inputs['Quality'].default_value = 'High'; gl.inputs['Threshold'].default_value = .6; gl.inputs['Strength'].default_value = .35
        out = tree.nodes.new('NodeGroupOutput'); tree.links.new(rl.outputs['Image'], gl.inputs['Image']); tree.links.new(gl.outputs['Image'], out.inputs['Image'])
    except Exception as e:
        print('Optional compositor', e)
    return s


def build(s):
    # 협탁
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, .08, -.025)); top = bpy.context.object; top.name = 'Nightstand'
    top.scale = (1.3, 0.95, 0.05); top.data.materials.append(walnut())

    # 휴대전화: 티타늄 몸체 + 검은 유리 + 어둡게 빛나는 화면
    ti = material('Dark titanium', (.16, .165, .17), 1.0, .32)
    glass = material('Black glass', (.004, .005, .007), 0.0, .06, coat=1.0)
    screen_m = material('Sleeping screen', (0, 0, 0), 0.0, .15, emission=(.11, .15, .24), strength=1.4)
    phone = bpy.data.objects.new('Phone', None); bpy.context.collection.objects.link(phone)
    phone.location = PHONE_POS; phone.rotation_euler = (0, 0, PHONE_ROT)
    body = rounded_slab('Phone body', PHONE['w'], PHONE['h'], PHONE['d'], PHONE['r'], ti, edge=.0011); body.parent = phone; body.location = (0, 0, PHONE['d'] / 2)
    face = rounded_slab('Phone glass', PHONE['w'] - .0012, PHONE['h'] - .0012, .0004, PHONE['r'] - .0006, glass); face.parent = phone; face.location = (0, 0, PHONE['d'] + .0001)
    sw, sh = PHONE['w'] - 2 * PHONE['bezel'], PHONE['h'] - 2 * PHONE['bezel']
    screen = rounded_slab('Phone screen', sw, sh, .0002, PHONE['sr'], screen_m); screen.parent = phone; screen.location = (0, 0, PHONE['d'] + .0004)
    # 화면에서 번지는 빛: 탁자 위에 차가운 빛 웅덩이
    bpy.ops.object.light_add(type='POINT', location=(PHONE_POS.x - .01, PHONE_POS.y, .07)); spill = bpy.context.object
    spill.data.energy = .9; spill.data.color = (.62, .76, 1.0); spill.data.shadow_soft_size = .05
    if hasattr(spill.data, 'specular_factor'): spill.data.specular_factor = 0.0
    bpy.ops.object.light_add(type='AREA', location=(PHONE_POS.x, PHONE_POS.y, .004)); up = bpy.context.object
    up.data.shape = 'RECTANGLE'; up.data.size = sw; up.data.size_y = sh; up.data.energy = .8; up.data.color = (.6, .74, 1.0)
    up.rotation_euler = (math.pi, 0, PHONE_ROT)  # 위를 향해: 물컵과 책의 옆면에 비친다

    # 충전 선
    cu = bpy.data.curves.new('Cable', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = .0017; cu.bevel_resolution = 4
    sp = cu.splines.new('BEZIER'); pts = [(.006, -.078, .003), (.03, -.13, .0017), (.12, -.2, .0017), (.34, -.19, .0017)]
    sp.bezier_points.add(len(pts) - 1)
    for bp, co in zip(sp.bezier_points, pts): bp.co = Vector(co); bp.handle_left_type = bp.handle_right_type = 'AUTO'
    cable = bpy.data.objects.new('Cable', cu); bpy.context.collection.objects.link(cable); cable.data.materials.append(material('Cable', (.45, .46, .48), 0, .55))
    cable.rotation_euler = (0, 0, PHONE_ROT)

    # 물컵과 책 (초점 밖)
    glass_m = bpy.data.materials.new('Water glass'); glass_m.use_nodes = True
    gb = glass_m.node_tree.nodes['Principled BSDF']; gb.inputs['Transmission Weight'].default_value = 1.0; gb.inputs['Roughness'].default_value = .02; gb.inputs['IOR'].default_value = 1.45
    if hasattr(glass_m, 'surface_render_method'): glass_m.surface_render_method = 'BLENDED'
    bpy.ops.mesh.primitive_cylinder_add(radius=.034, depth=.105, vertices=64, location=(-.14, .25, .0525)); cup = bpy.context.object; cup.data.materials.append(glass_m)
    for poly in cup.data.polygons: poly.use_smooth = True
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-.36, .16, .012)); book = bpy.context.object
    book.scale = (.16, .23, .024); book.rotation_euler = (0, 0, math.radians(22)); book.data.materials.append(material('Cloth cover', (.03, .04, .05), 0, .85))

    # 달빛과 블라인드 그림자
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 2)); sun = bpy.context.object
    sun.data.energy = 1.5; sun.data.color = (.42, .55, .9); sun.data.angle = math.radians(1.2)
    sun.rotation_euler = (math.radians(38), 0, math.radians(-118))
    blinds = bpy.data.objects.new('Blinds', None); bpy.context.collection.objects.link(blinds)
    d = sun.matrix_world.to_3x3() @ Vector((0, 0, 1))
    blinds.location = d * .9 + Vector((-.05, .05, 0)); blinds.rotation_euler = sun.rotation_euler
    for i in range(-16, 17):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0)); slat = bpy.context.object
        slat.scale = (1.4, .028, .002); slat.parent = blinds; slat.location = (0, i * .05, 0)
        slat.visible_camera = False; slat.visible_glossy = False
    # 방 안쪽의 아주 약한 채움 빛
    bpy.ops.object.light_add(type='AREA', location=(.5, -.6, .9)); fill = bpy.context.object
    fill.data.size = 1.2; fill.data.energy = 1.6; fill.data.color = (.35, .42, .6); fill.rotation_euler = (math.radians(50), 0, math.radians(35))

    # 카메라: 위에서 비스듬히, 휴대전화는 화면 오른쪽
    bpy.ops.object.camera_add(); cam = bpy.context.object; s.camera = cam
    cam.data.lens = 50; cam.data.sensor_fit = 'HORIZONTAL'; cam.data.sensor_width = 36
    target = PHONE_POS + Vector((-.132, .01, 0))
    el, az, dist = math.radians(62), math.radians(-4), .525
    cam.location = target + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * dist
    look = target - cam.location; cam.rotation_euler = look.to_track_quat('-Z', 'Y').to_euler()
    cam.data.dof.use_dof = True; cam.data.dof.focus_object = screen; cam.data.dof.aperture_fstop = 2.2
    return screen, sw, sh


s = setup()
screen, sw, sh = build(s)
bpy.context.view_layer.update()
corners = []
for cx, cy in [(-1, 1), (1, 1), (1, -1), (-1, -1)]:  # 화면 기준 왼쪽 위 → 오른쪽 위 → 오른쪽 아래 → 왼쪽 아래
    world = screen.matrix_world @ Vector((cx * sw / 2, cy * sh / 2, .0001))
    v = world_to_camera_view(s, s.camera, world)
    corners.append([round(v.x * 1920, 2), round((1 - v.y) * 1080, 2)])
OUT.mkdir(parents=True, exist_ok=True)
png = OUT / f'night-phone.{a.mode}.png'
s.render.filepath = str(png); bpy.ops.render.render(write_still=True)
jpg = OUT / ('night-phone.jpg' if a.mode == 'final' else 'night-phone.sample.jpg')
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(png), '-q:v', '2', str(jpg)], check=True)
png.unlink()
(OUT / 'night-phone.json').write_text(json.dumps({'renderer': 'Blender EEVEE', 'size': [1920, 1080], 'screen': {'corners': corners, 'widthMm': round(sw * 1000, 1), 'heightMm': round(sh * 1000, 1)}}, indent=2) + '\n')
print('RENDERED', jpg, corners, flush=True)
