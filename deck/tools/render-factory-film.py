#!/usr/bin/env python3
"""Actual Blender cinematography for Keynote cues 18–22.

Run with Blender 5+: blender -b --python deck/tools/render-factory-film.py -- --mode samples
Preview: --mode preview --phases 18,19 (12fps, 960x540)
Final: --mode final (24fps, 1280x720, resumes existing numbered PNGs).
Scenes share precise final/start camera states; intentional match cuts are occluded
by physical screen edges, shutter blades, and a record's center iris.
"""
import bpy, math, json, sys, argparse, subprocess, time, random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'public/factory-film'
WORK = ROOT/'render/blender-film'
TEX = WORK/'textures'
BIRD = ROOT/'public/engines/factory-assets/hummingbird.png'
LECTURE = ROOT/'public/demos/tts-lecture.jpg'
PEAKS = json.loads((ROOT/'src/keynote/data/music-waveform.json').read_text())['peaks']
NAMES = {18:'01-enter',19:'02-voice',20:'03-image',21:'04-music',22:'05-reveal'}
ARGS = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
p = argparse.ArgumentParser()
p.add_argument('--mode', choices=['samples','preview','final'], default='samples')
p.add_argument('--phases',default='18,19,20,21,22')
p.add_argument('--force',action='store_true')
p.add_argument('--samples',type=int,default=48)
p.add_argument('--frames',default='')
a=p.parse_args(ARGS)
OUT.mkdir(parents=True,exist_ok=True);WORK.mkdir(parents=True,exist_ok=True)
random.seed(17)


def material(name, color, metal=0.0, rough=.35, emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    if emission:
        bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emission
    return m

def image_material(path, name, strength=.8):
    m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;n.clear()
    out=n.new('ShaderNodeOutputMaterial');em=n.new('ShaderNodeEmission');im=n.new('ShaderNodeTexImage')
    im.image=bpy.data.images.load(str(path),check_existing=True);im.interpolation='Linear'
    em.inputs['Strength'].default_value=strength
    m.node_tree.links.new(im.outputs['Color'],em.inputs['Color']);m.node_tree.links.new(em.outputs[0],out.inputs['Surface'])
    return m

def cube(name,loc,scale,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    if bevel:
        mo=o.modifiers.new('machined edge','BEVEL');mo.width=bevel;mo.segments=3
        o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
    return o

def plane(name,loc,w,h,mat):
    # Screen faces camera on its negative Y side.
    verts=[(-w/2,0,-h/2),(w/2,0,-h/2),(w/2,0,h/2),(-w/2,0,h/2)]
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],[(0,1,2,3)]);me.update()
    uv=me.uv_layers.new(name='UVMap')
    for i,co in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[i].uv=co
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.location=loc;o.data.materials.append(mat)
    return o

def framed_screen(name,loc,w,h,mat,frame=True):
    x,y,z=loc;os=[]
    if frame:
        os.append(cube(name+' solid screen',(x,y+.095,z),(w+.18,.17,h+.18),DARK,.07))
        for dx in [-w/2-.055,w/2+.055]:os.append(cube(name+' frame',(x+dx,y-.01,z),(.055,.1,h+.16),GOLD,.018))
        for dz in [-h/2-.055,h/2+.055]:os.append(cube(name+' frame',(x,y-.01,z+dz),(w+.15,.1,.055),GOLD,.018))
    os.append(plane(name,loc,w,h,mat));return os

def curve(name,points,mat,thick=.018):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=1;cu.bevel_depth=thick;cu.bevel_resolution=2
    sp=cu.splines.new('POLY');sp.points.add(len(points)-1)
    for pt,co in zip(sp.points,points):pt.co=(*co,1)
    o=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(o);o.data.materials.append(mat);return o

def ring(name,center,r,mat,thick=.025,segments=96):
    x,y,z=center
    return curve(name,[(x+r*math.cos(i*math.tau/segments),y+r*math.sin(i*math.tau/segments),z) for i in range(segments+1)],mat,thick)

def cylinder(name,loc,r,depth,mat,vertices=96):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc)
    o=bpy.context.object;o.name=name;o.data.materials.append(mat)
    be=o.modifiers.new('polished lip','BEVEL');be.width=.025;be.segments=3
    o.modifiers.new('weighted normals','WEIGHTED_NORMAL');return o

def area(name,loc,target,color,power,size=7):
    da=bpy.data.lights.new(name,'AREA');da.energy=power;da.color=color;da.shape='DISK';da.size=size
    ob=bpy.data.objects.new(name,da);bpy.context.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler();return ob

def text_obj(body,loc,size=.18,rot=(math.pi/2,0,0),mat=None):
    cu=bpy.data.curves.new('engraved '+body,'FONT');cu.body=body;cu.size=size;cu.space_character=1.25;cu.extrude=.001
    o=bpy.data.objects.new('engraved '+body,cu);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=rot;o.data.materials.append(mat or GOLD);return o

def all_objects():return set(bpy.context.scene.objects)
def group_since(before):return list(all_objects()-before)
def vis_key(obs,frames):
    for ob in obs:
        for f,show in frames:
            ob.hide_render=not show;ob.keyframe_insert(data_path='hide_render',frame=f)

def key_camera(frame,loc,target,lens=38,roll=0,fstop=7):
    CAM.location=loc;rot=(Vector(target)-CAM.location).to_track_quat('-Z','Y').to_euler();rot.rotate_axis('Z',math.radians(roll));CAM.rotation_euler=rot
    CAM.data.lens=lens;CAM.data.dof.focus_distance=(Vector(target)-CAM.location).length;CAM.data.dof.aperture_fstop=fstop
    CAM.keyframe_insert(data_path='location',frame=frame);CAM.keyframe_insert(data_path='rotation_euler',frame=frame)
    CAM.data.keyframe_insert(data_path='lens',frame=frame);CAM.data.keyframe_insert(data_path='dof.focus_distance',frame=frame);CAM.data.keyframe_insert(data_path='dof.aperture_fstop',frame=frame)

def linearize():
    # Blender 5 uses layered actions, traverse action slots via channel bags.
    for ob in list(bpy.data.objects)+list(bpy.data.cameras):
        ad=ob.animation_data
        if not ad or not ad.action:continue
        action=ad.action
        try:
            for layer in action.layers:
                for strip in layer.strips:
                    for bag in strip.channelbags:
                        for fc in bag.fcurves:
                            if fc.data_path=='hide_render':continue
                            for k in fc.keyframe_points:k.interpolation='BEZIER';k.handle_left_type='AUTO_CLAMPED';k.handle_right_type='AUTO_CLAMPED'
        except Exception:pass

def setup():
    global CAM,DARK,GOLD,TEAL,CREAM,GLOW,STEEL,BIRDMAT,LECTUREMAT
    bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene
    s.render.engine='CYCLES' if False else 'BLENDER_EEVEE'
    s.render.resolution_x=640 if a.mode=='samples' else 960 if a.mode=='preview' else 1280
    s.render.resolution_y=s.render.resolution_x*9//16;s.render.resolution_percentage=100
    s.render.fps=24;s.frame_start=1;s.frame_end=60
    s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGB';s.render.image_settings.color_depth='8'
    s.render.film_transparent=False
    if hasattr(s,'eevee'):
        s.eevee.taa_render_samples=a.samples if a.mode=='final' else 12
        if hasattr(s.eevee,'use_gtao'):s.eevee.use_gtao=True
        if hasattr(s.eevee,'use_raytracing'):s.eevee.use_raytracing=(a.mode=='final')
    if hasattr(s.render,'use_motion_blur'):s.render.use_motion_blur=(a.mode!='samples');s.render.motion_blur_shutter=.32
    s.world=bpy.data.worlds.new('Ink atmosphere');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.009,.014,.018,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.22
    s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=.25
    DARK=material('Black nickel',(.023,.037,.046),.7,.28)
    GOLD=material('Warm brushed brass',(.55,.3,.105),.82,.26)
    TEAL=material('Petroleum enamel',(.025,.16,.17),.6,.3)
    CREAM=material('Warm paper',(.63,.59,.47),.05,.54)
    GLOW=material('Teal luminous inlay',(.04,.64,.57),.2,.26,2)
    STEEL=material('Titanium',(.25,.3,.32),.82,.22)
    BIRDMAT=image_material(BIRD,'Actual generated hummingbird',.86)
    LECTUREMAT=image_material(LECTURE,'Actual TTS lecture',.95)
    bpy.ops.object.camera_add();CAM=bpy.context.object;CAM.name='Cinematography';s.camera=CAM;CAM.data.clip_start=.035;CAM.data.clip_end=400;CAM.data.dof.use_dof=True
    # Restrained bloom in the final composite; original footage remains legible.
    try:
        tree=bpy.data.node_groups.new('Optical glow','CompositorNodeTree')
        tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
        s.compositing_node_group=tree
        rl=tree.nodes.new('CompositorNodeRLayers');gl=tree.nodes.new('CompositorNodeGlare');gl.inputs['Type'].default_value='Fog Glow';gl.inputs['Quality'].default_value='Low';gl.inputs['Threshold'].default_value=2.5;gl.inputs['Strength'].default_value=.18
        out=tree.nodes.new('NodeGroupOutput');tree.links.new(rl.outputs['Image'],gl.inputs['Image']);tree.links.new(gl.outputs['Image'],out.inputs['Image'])
    except Exception as e:print('Optional compositor',e)
    return s

PORTAL_END=((-1.2,-18.5,6.7),(0,0,4.8),32,0)
VOICE_END=((0,11.8,7.3),(0,28,7.3),32,0)
IMAGE_END=((40,-8.8,8.3),(40,10,8.3),42,0)
MUSIC_END=((70,-.001,17.8),(70,0,.25),39,0)

def camera_state(f,state):key_camera(f,*state)

def workshop():
    before=all_objects()
    cube('Infinite workshop floor',(0,10,-.3),(90,100,.5),DARK,.1)
    for x in [-13,13]:
        cube('Architectural pier',(x,8,7),(1.2,45,14),DARK,.15)
        for z in [1,6,11]:cube('Pier luminous incision',(x-(.63 if x>0 else -.63),3,z),(.03,26,.024),GLOW)
    for x in [-7,0,7]:
        cube('Monumental slab',(x,.5,5),(5.25,.45,9.5),DARK,.08)
        for xx in [x-2.66,x+2.66]:cube('Brass upright',(xx,.43,5),(.05,.52,9.65),GOLD,.012)
        cube('Portal footing',(x,.4,.24),(5.8,1.6,.4),DARK,.08)
        cube('Light in floor',(x,-.8,.005),(4.9,.03,.018),GLOW)
    framed_screen('01 VOICE preview',(0,.24,5.3),4.95,2.785,LECTUREMAT)
    framed_screen('02 IMAGE preview',(-7,.24,5.5),4.7,4.7,BIRDMAT)
    # Wall-mounted radial record preview is physical brass relief, not an icon.
    for j in range(36):
        ang=j*math.tau/36;r=1.2;h=.2+PEAKS[j%len(PEAKS)]*1.6
        o=cube('Score carved into slab',(7+math.cos(ang)*r,.17,5.5+math.sin(ang)*r),(.04,.15,h),GOLD,.016);o.rotation_euler[1]=-ang
    for i,(x,label) in enumerate([(-7,'02 / IMAGE'),(0,'01 / VOICE'),(7,'03 / MUSIC')]):text_obj(label,(x-2.3,.16,8.95),.16,mat=CREAM)
    # Projector tracks lead into depth and cast actual light/shadow.
    for x in [-8,-3,3,8]:cube('Floor rail',(x,15,.02),(.02,64,.03),GOLD)
    area('Long teal softbox',(-10,-4,12),(0,2,4),(.25,.82,.85),2000,10)
    area('Amber workshop key',(7,-8,10),(0,0,4),(1,.55,.25),2400,9)
    area('Far atelier',(0,20,13),(0,12,0),(.35,.65,.72),2300,10)
    return group_since(before)

def voice_stage():
    before=all_objects()
    for i in range(34):
        y=2+i*.59;phase=i*.45
        for side in [-1,1]:
            h=1.7+(math.sin(phase*1.6)*.5+.5)*3.5
            x=side*(3.1+math.cos(phase)*.4)
            ob=cube('Voice waveform fin',(x,y,3.6),(0.08,.21,h),GOLD,.025)
            # Narrow emissive edge guides the camera through the physical voice.
            cube('Voice edge',(x-side*.046,y-.09,3.6),(.015,.025,h*.9),GLOW)
    for k in range(5):
        points=[(-4.4+8.8*i/80,2.3+k*3,4.2+.42*math.sin(i*.3+k)*math.sin(math.pi*i/80)) for i in range(81)]
        curve('Suspended spoken cadence',points,TEAL,.025)
    framed_screen('Finished voice lecture',(0,28,7.3),16,9,LECTUREMAT)
    for x in [-8.4,8.4]:cube('Lecture vertical light',(x,28.1,7.3),(.04,.07,10.5),GLOW)
    text_obj('01 / SPOKEN INTO A FINISHED LECTURE',(-8,27.9,12.3),.15,mat=CREAM)
    area('Voice ceiling',(0,13,12),(0,12,4),(1,.63,.32),1500,7)
    area('Lecture rim',(0,26,13),(0,25,2),(.2,.8,.72),1800,8)
    return group_since(before)

def image_stage():
    before=all_objects()
    cube('Image atelier floor',(40,5,-.3),(38,40,.5),DARK,.1)
    hero=TEX/'hummingbird-hero-wide.png'
    hero_mat=image_material(hero,'Full bird generated hero',.88) if hero.exists() else BIRDMAT
    # Central image uses the actual generated work; flanking planes reveal its detail.
    framed_screen('Final bird image',(40,10,8.3),12,9.26,hero_mat,False)
    for i,(dx,y,z,ang) in enumerate([(-7,1,7,-22),(7,3,7,24),(-5,6,8,-12),(5,7,8,14)]):
        paths=[TEX/'hummingbird-wing.png',TEX/'hummingbird-head.png']
        ip=paths[i%2];mat=image_material(ip,'Bird detail '+str(i),.7) if ip.exists() else BIRDMAT
        os=framed_screen('Layered material study '+str(i),(40+dx,y,z),4.5,6,mat)
        origin=Vector((40+dx,y,z))
        for ob in os:
            q=Vector(ob.location)-origin;angle=math.radians(ang);ob.location=origin+Vector((q.x*math.cos(angle)-q.y*math.sin(angle),q.x*math.sin(angle)+q.y*math.cos(angle),q.z));ob.rotation_euler[2]=angle
            # Panels withdraw outside the hero's final crop.
            ob.keyframe_insert(data_path='location',frame=38)
            ob.location.x+=(-9 if dx<0 else 9);ob.keyframe_insert(data_path='location',frame=57)
    area('Image turquoise edge',(30,4,14),(40,7,5),(.18,.73,.78),1400,9)
    area('Image amber edge',(51,7,13),(40,7,4),(1,.67,.33),1800,9)
    return group_since(before)

def music_stage():
    before=all_objects()
    cube('Record studio ground',(70,0,-.4),(32,32,.5),DARK)
    cylinder('Cut vinyl master',(70,0,.05),5.15,.22,DARK,192)
    cylinder('Center label',(70,0,.19),1.1,.02,GOLD)
    cylinder('Center aperture',(70,0,.21),.25,.025,material('Deep aperture',(.0001,.0002,.0002),0,1))
    for i in range(75):ring('Concentric sound groove',(70,0,.2),1.19+i*.051,GOLD if i%14==0 else STEEL,.007 if i%14 else .012,128)
    for i in range(160):
        th=i*math.tau/160;amp=PEAKS[round(i*(len(PEAKS)-1)/159)]
        r=3.55;length=.12+amp*1.12
        ob=cube('Real music waveform relief',(70+math.cos(th)*r,math.sin(th)*r,.29+amp*.22),(.042,length,.07+amp*.44),GLOW if i%8==0 else GOLD,.018)
        ob.rotation_euler[2]=th-math.pi/2
    # Real machined stylus sweeping above the record, with no display plinth.
    cylinder('Tonearm pivot',(76,2,.25),.55,.42,STEEL)
    curve('Tonearm',[(76,2,.65),(75,1.7,.8),(73.9,-1.3,.62),(73.5,-1.6,.42)],STEEL,.085)
    cube('Cartridge',(73.5,-1.6,.32),(.45,.64,.24),DARK,.04)
    ring('Master edge',(70,0,.19),5.13,GOLD,.024,192)
    text_obj('03 / GENERATED SOUND',(68.98,-.42,.23),.105,rot=(0,0,0),mat=DARK)
    area('Record long amber strip',(73,-5,9),(70,0,0),(1,.63,.3),1800,7)
    area('Record teal strip',(63,4,7),(70,0,0),(.15,.68,.73),2000,8)
    return group_since(before)

def montage_stage():
    before=all_objects()
    cube('Projection hall floor',(110,0,-.4),(75,75,.5),DARK)
    paths=sorted(TEX.glob('tts-*.png'))
    sources=[LECTURE,BIRD]+paths
    # A spatial editing timeline: real frames at multiple depths, not objects on plinths.
    poses=[(-8,8,5.8,7.3,4.1,0),(0,11,8.5,9.4,5.3,0),(9,14,6.5,7.2,4.05,-12),(-11,20,10.2,6.2,3.5,10),(1,25,4.5,7.2,4.05,0),(11,27,12,6.8,3.83,-8),(-1,34,14,7.8,4.39,0),(-13,32,5.4,5.7,3.2,8),(16,39,6.7,7.5,4.22,-10)]
    for i,(x,y,z,w,h,rot) in enumerate(poses):
        path=sources[i%len(sources)];mat=image_material(path,'Actual work montage '+str(i),1.45)
        if path==BIRD:w=h=11
        os=framed_screen('Projected work '+str(i),(110+x,y,z),w,h,mat)
        for ob in os:ob.rotation_euler[2]=math.radians(rot)
        # Projection shafts are geometric luminous floor paths rather than particles.
        curve('Editing track '+str(i),[(110+x,y,-.1),(110+x,y,.04),(110+x,y+5,.04)],GLOW,.012)
    for x in [-17,17]:
        for y in [6,18,30,43]:cube('Projection hall structure',(110+x,y,9),(.12,.2,18),GOLD,.02)
    for i in range(3):
        yy=10+i*12
        area('Projection hall light '+str(i),(110+(-1)**i*11,yy,17),(110,yy,0),(.15,.57,.61) if i%2 else (1,.62,.32),2100,10)
    return group_since(before)

def shutter(start,end):
    # A real opaque screen-mounted blade sweeps across the lens to motivate a cut.
    ob=cube('Physical shutter across lens',(0,0,0),(4.3,4,.03),DARK)
    ob.parent=CAM;ob.location=(-6,0,-1.2);ob.rotation_euler=(0,0,math.radians(-19))
    ob.keyframe_insert(data_path='location',frame=start)
    ob.location=(0,0,-1.2);ob.keyframe_insert(data_path='location',frame=(start+end)//2)
    ob.location=(6,0,-1.2);ob.keyframe_insert(data_path='location',frame=end)
    vis_key([ob],[(1,False),(start,True),(end,True),(end+1,False)])


def iris(start,end):
    # A circular physical aperture inherits the record center's silhouette.
    seg=128;inner=.0001;outer=3.0
    vs=[(math.cos(i*math.tau/seg)*r,math.sin(i*math.tau/seg)*r,0) for r in [inner,outer] for i in range(seg)]
    fs=[(i,(i+1)%seg,(i+1)%seg+seg,i+seg) for i in range(seg)]
    me=bpy.data.meshes.new('Circular aperture');me.from_pydata(vs,[],fs);me.update()
    ob=bpy.data.objects.new('Record-center circular iris',me);bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material('Iris inside',(.0001,.0002,.0002),0,1))
    ob.parent=CAM;ob.location=(0,0,-1.0)
    ob.shape_key_add(name='Closed');op=ob.shape_key_add(name='Open')
    for i in range(seg):op.data[i].co=(math.cos(i*math.tau/seg)*1.3,math.sin(i*math.tau/seg)*1.3,0)
    for frame,value in [(start,0),(start+1,.14),(end,1)]:op.value=value;op.keyframe_insert(data_path='value',frame=frame)
    vis_key([ob],[(1,False),(start,True),(end,True),(end+1,False)])


def build(phase):
    s=setup()
    if phase==18:
        workshop();voice_stage()
        key_camera(1,(-9,-2.8,7.6),(-7,.3,6.4),42,-5)
        key_camera(28,(-8,-10,8),(-1,0,5.3),32,-2)
        camera_state(60,PORTAL_END)
    elif phase==19:
        portals=workshop();voice_stage()
        camera_state(1,PORTAL_END)
        key_camera(14,(0,-8,5.5),(0,1,5.2),29,0)
        key_camera(27,(0,3.5,4.8),(0,17,4.9),25,0,3.5)
        key_camera(38,(.8,12,4.9),(0,28,7.3),27,3,4)
        camera_state(58,VOICE_END);camera_state(60,VOICE_END)
        # Central slab opens physically into two tall doors as camera approaches.
        for ob in portals:
            if ('slab' in ob.name or 'VOICE preview' in ob.name or 'upright' in ob.name) and abs(ob.location.x)<2.9:
                ob.keyframe_insert(data_path='location',frame=7);ob.location.x+=(-5.8 if ob.location.x<=0 else 5.8);ob.keyframe_insert(data_path='location',frame=23)
    elif phase==20:
        w=workshop()+voice_stage();im=image_stage()
        camera_state(1,VOICE_END)
        # Track the frame itself on every frame; interpolating rotations here
        # would miss the narrow edge and expose a blank panel backside.
        points=[(1,(0,11.8,7.3),(0,28,7.3),32),(12,(3,18,7.5),(6,28,7.5),35),(20,(7,25.7,7.7),(8.055,28,7.7),39),(26,(8.055,27.77,7.7),(8.055,28,7.7),40)]
        for left,right in zip(points,points[1:]):
            for f in range(left[0],right[0]+1):
                q=(f-left[0])/(right[0]-left[0]);q=q*q*(3-2*q)
                loc=Vector(left[1]).lerp(Vector(right[1]),q);target=Vector(left[2]).lerp(Vector(right[2]),q)
                key_camera(f,loc,target,left[3]+(right[3]-left[3])*q,0,10)
        # The gold lecture frame is a match cut to an image-frame edge.
        key_camera(27,(30.859,1.59,7.7),(30.859,1.854,7.7),40,0,10)
        key_camera(38,(34,-3,9.5),(40,10,8.3),32,-5,5)
        key_camera(48,(43,-6.8,9),(40,10,8.3),38,2,6)
        camera_state(60,IMAGE_END)
        vis_key(w,[(1,True),(26,True),(27,False)]);vis_key(im,[(1,False),(26,False),(27,True)])
    elif phase==21:
        im=image_stage();mu=music_stage()
        # Reproduce cue20 final withdrawal immediately for exact continuity.
        for ob in im:
            if 'Layered material' in ob.name:
                ob.animation_data_clear();ob.location.x+=0
        camera_state(1,IMAGE_END)
        key_camera(15,(46,-1.1,9.7),(43.5,10,10),44,-13,5)
        key_camera(22,(52,4,10),(50,10,9),50,-30,3)
        key_camera(23,(73,-3.1,1.1),(69.7,0,.22),40,-27,3)
        key_camera(36,(71,-6.6,9),(70,0,.3),37,-12,5)
        camera_state(58,MUSIC_END);camera_state(60,MUSIC_END)
        vis_key(im,[(1,True),(22,True),(23,False)]);vis_key(mu,[(1,False),(22,False),(23,True)])
        shutter(17,28)
    elif phase==22:
        mu=music_stage();mont=montage_stage()
        camera_state(1,MUSIC_END)
        key_camera(16,(70,-.001,5),(70,0,.2),43,18,7)
        key_camera(27,(70,0,.46),(70,0,.19),35,40,8)
        key_camera(28,(110,-.3,4.8),(110,11,8.5),35,0,6)
        key_camera(39,(108,-7,8),(110,17,7.8),29,0,7)
        key_camera(60,(111,-7,14),(110,19,8.5),34,0,9)
        vis_key(mu,[(1,True),(27,True),(28,False)]);vis_key(mont,[(1,False),(27,False),(28,True)])
        # Black center fills the lens then opens out onto the media projection hall.
        iris(28,35)
    linearize();s.frame_set(60)
    return s


def render_one(s,phase,frame,directory):
    dst=directory/f'{frame:04}.png'
    if dst.exists() and not a.force:return dst
    s.frame_set(frame);s.render.filepath=str(dst)
    # Never integrate camera positions across an editorial cut.
    s.render.use_motion_blur=(a.mode!='samples' and not (phase==20 and 25<=frame<=29) and not (phase==21 and 21<=frame<=24) and not (phase==22 and 26<=frame<=29))
    ts=time.monotonic();bpy.ops.render.render(write_still=True)
    print(json.dumps({'phase':phase,'frame':frame,'seconds':round(time.monotonic()-ts,2),'path':str(dst)}),flush=True)
    return dst


def encode(phase,folder,fps,preview=False):
    import shutil
    seq=folder/'sequence';seq.mkdir(exist_ok=True)
    rendered=sorted(folder.glob('[0-9][0-9][0-9][0-9].png'))
    for i,path in enumerate(rendered,1):
        dest=seq/f'{i:04}.png'
        if dest.exists():dest.unlink()
        dest.symlink_to(path.resolve())
    last=rendered[-1]
    target=(WORK/'preview'/f'{NAMES[phase]}.mp4') if preview else OUT/f'{NAMES[phase]}.mp4'
    target.parent.mkdir(exist_ok=True,parents=True)
    # Actual camera frames, then a clean 1.5 second landed hold.
    temporary=target.with_name(target.stem+'.rendering.mp4')
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate',str(fps),'-i',str(seq/'%04d.png'),'-vf','tpad=stop_mode=clone:stop_duration=1.5','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart','-r','24',str(temporary)]
    subprocess.run(cmd,check=True)
    poster=target.with_suffix('.jpg');poster_temporary=target.with_name(target.stem+'.rendering.jpg')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-sseof','-0.042','-i',str(temporary),'-frames:v','1','-q:v','1',str(poster_temporary)],check=True)
    temporary.replace(target);poster_temporary.replace(poster)
    print('ENCODED',target,flush=True)
    return target

# Derived textures are reproducible from the real, checked-in works.
def prepare_textures():
    TEX.mkdir(parents=True,exist_ok=True)
    recipes=[('hummingbird-hero-wide.png',BIRD,'crop=1024:790:0:65,scale=1536:1185'),('hummingbird-wing.png',BIRD,'crop=620:620:390:80,scale=1024:1024'),('hummingbird-head.png',BIRD,'crop=480:480:240:300,scale=1024:1024')]
    for name,source,filter_ in recipes:
        dst=TEX/name
        if not dst.exists():subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-vf',filter_,'-frames:v','1',str(dst)],check=True)
    for name,t in [('tts-01-workflow.png',4),('tts-02-agent.png',14),('tts-03-document.png',22),('tts-04-document-explained.png',23.4)]:
        dst=TEX/name
        if not dst.exists():subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(t),'-i',str(ROOT/'public/demos/tts-lecture.mp4'),'-frames:v','1',str(dst)],check=True)

prepare_textures()

phases=[int(x) for x in a.phases.split(',')]
for phase in phases:
    s=build(phase)
    directory=WORK/a.mode/str(phase);directory.mkdir(parents=True,exist_ok=True)
    frames=([int(f) for f in a.frames.split(',')] if a.frames else [1,24,42,60]) if a.mode=='samples' else list(range(1,61,2)) + [60] if a.mode=='preview' else list(range(1,61))
    for frame in frames:render_one(s,phase,frame,directory)
    if a.mode!='samples':encode(phase,directory,12 if a.mode=='preview' else 24,a.mode=='preview')
    if a.mode=='final':bpy.ops.wm.save_as_mainfile(filepath=str(WORK/f'cue-{phase}.blend'))
    print('PHASE_COMPLETE',phase,flush=True)

if a.mode=='final':
    clips=[]
    transitions={18:'architectural lateral crane',19:'opening portal / forward plunge through voice relief',20:'lecture-frame / image-frame surface match cut',21:'wing-edge whip / physical shutter to overhead record',22:'record-center iris / rising reveal of actual-media montage'}
    for phase,name in NAMES.items():
        path=OUT/f'{name}.mp4'
        if path.exists():
            probe=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_format','-of','json',str(path)]))
            clips.append({'phase':phase,'src':f'/factory-film/{name}.mp4','poster':f'/factory-film/{name}.jpg','duration':float(probe['format']['duration']),'fps':24,'width':1280,'height':720,'transition':transitions[phase],'hold':'final frame','sources':['/demos/tts-lecture.jpg','/demos/tts-lecture.mp4','/engines/factory-assets/hummingbird.png','src/keynote/data/music-waveform.json']})
    manifest=OUT/'manifest.rendering.json'
    manifest.write_text(json.dumps({'renderer':'Blender EEVEE','clips':clips},indent=2)+'\n')
    manifest.replace(OUT/'manifest.json')
