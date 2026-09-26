#!/usr/bin/env python3
"""Export the finished slide-film house as a compact, browser-ready GLB.

Run from the repository root:
    blender -b --python construction-site/tools/export-house-glb.py

The slide source builds a complete city for its film. This exporter evaluates only
its definitions and builds the 11 house parts. The original slide files stay intact.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "deck/tools/render-house-scroll.py"
OUTPUT = ROOT / "construction-site/public/models/house.glb"

# All geometry and the assembly's eleven named parent objects come from the film.
# Stop before the source's top-level scene build and render/export side effects.
source_text = SOURCE.read_text(encoding="utf-8")
marker = "\nt0 = time.time()\n"
if marker not in source_text:
    raise RuntimeError("The slide source changed; update the exporter boundary.")
scope = {"__file__": str(SOURCE), "__name__": "house_scroll_source"}
exec(compile(source_text.split(marker, 1)[0], str(SOURCE), "exec"), scope)
scope["build_house"]()

bpy = scope["bpy"]
parts = scope["PARTS"]

# The film animates area lights. Web lighting belongs to the Three.js scene.
for obj in list(bpy.data.objects):
    if obj.type == "LIGHT":
        bpy.data.objects.remove(obj, do_unlink=True)


def make_material(name, *, color, roughness, metallic=0, alpha=1, emission=None, strength=0):
    """Use only core glTF PBR inputs so the web result is predictable."""
    mat = bpy.data.materials.new("WEB · " + name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    mat.node_tree.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Alpha"].default_value = alpha
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    mat.diffuse_color = (*color, alpha)
    if alpha < 1:
        mat.surface_render_method = "BLENDED"
        mat.use_backface_culling = False
    return mat


# The original uses Cycles-only noise, object attributes, and light-path shaders.
# Matching web PBR finishes keep the shape and palette without broken node exports.
finishes = {
    "board concrete": dict(color=(.52, .51, .48), roughness=.88),
    "plinth concrete": dict(color=(.19, .20, .19), roughness=.88),
    "slab concrete": dict(color=(.59, .58, .55), roughness=.76),
    "terrace stone": dict(color=(.42, .40, .37), roughness=.77),
    "cedar cladding": dict(color=(.40, .22, .12), roughness=.69),
    "oak floor": dict(color=(.50, .32, .19), roughness=.57),
    "plaster": dict(color=(.77, .75, .70), roughness=.91),
    "linen": dict(color=(.51, .49, .45), roughness=.96),
    "walnut": dict(color=(.12, .075, .045), roughness=.55),
    "kitchen stone": dict(color=(.71, .68, .63), roughness=.27),
    "bronze frame": dict(color=(.19, .16, .12), roughness=.31, metallic=.83),
    "window glass": dict(color=(.46, .60, .61), roughness=.13, alpha=.25),
    "reflecting pool": dict(color=(.22, .48, .52), roughness=.15, metallic=.08, alpha=.73),
    "pool tile": dict(color=(.37, .57, .60), roughness=.34),
    "roof membrane": dict(color=(.065, .067, .069), roughness=.89),
    "ceiling diffuser": dict(color=(.80, .76, .66), roughness=.61, emission=(1, .67, .36), strength=.65),
    "pendant glow": dict(color=(1, .56, .28), roughness=.47, emission=(1, .54, .24), strength=2.0),
    "downlight": dict(color=(1, .72, .43), roughness=.43, emission=(1, .65, .34), strength=1.7),
    "soffit led": dict(color=(1, .72, .45), roughness=.42, emission=(1, .68, .39), strength=1.4),
    "slot glow": dict(color=(1, .59, .29), roughness=.44, emission=(1, .57, .29), strength=1.15),
}

mapped = {key: make_material(key, **values) for key, values in finishes.items()}
meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
used_names = set()
for obj in meshes:
    for index, old in enumerate(obj.data.materials):
        if old is None:
            continue
        used_names.add(old.name)
        if old.name not in mapped:
            raise RuntimeError(f"Missing web finish: {old.name}")
        obj.data.materials[index] = mapped[old.name]

# Empty assembly parents are intentionally retained in the GLB. A site can find
# `part · upper box`, for example, and animate that whole assembly while scrolling.
if len(parts) != 11:
    raise RuntimeError(f"Expected 11 house parts, found {len(parts)}")
if len(meshes) != 28:
    raise RuntimeError(f"Expected 28 house meshes, found {len(meshes)}")

bpy.context.view_layer.update()
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT),
    export_format="GLB",
    export_yup=True,
    export_apply=True,  # bevels from the film become real web geometry
    export_animations=False,
    export_lights=False,
    export_cameras=False,
    export_materials="EXPORT",
    export_extras=False,
)

from mathutils import Vector

corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
minimum = tuple(round(min(c[i] for c in corners), 3) for i in range(3))
maximum = tuple(round(max(c[i] for c in corners), 3) for i in range(3))
print("HOUSE_GLB", OUTPUT, OUTPUT.stat().st_size, "bytes")
print("HOUSE_BOUNDS_BLENDER_XYZ", minimum, maximum)
print("HOUSE_PARTS", [part.root.name for part in parts])
print("HOUSE_MATERIALS", sorted(used_names))
