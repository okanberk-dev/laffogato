"""
The home page's journey, drawn in Blender (Cycles): a probe lens comes out of
a mound of roasted beans on the bar and arrives at the affogato in its
biscuit cup, at night, under the terrace's string lights. One Blender unit is
one centimetre.

    venv/bin/python scene.py --frames 0,60,119 --res 960x540 --samples 96 --out out/test

Writes one multilayer EXR per frame (scene-linear colour + the mist pass) and
meta.json; grade.py turns those into the colour and depth frames the site
loads.
"""

import argparse
import json
import math
import os
import time

import bpy
import numpy as np
from mathutils import Matrix, Vector, noise as mnoise
from scipy.interpolate import PchipInterpolator

bmesh = __import__("bmesh")  # only importable once bpy is loaded

# ───────────────────────────── arguments ─────────────────────────────

parser = argparse.ArgumentParser()
parser.add_argument("--frames", default="0")
parser.add_argument("--res", default="960x540")
parser.add_argument("--samples", type=int, default=96)
parser.add_argument("--threshold", type=float, default=0.03)
parser.add_argument("--out", default="out/test")
parser.add_argument("--portrait", action="store_true")
parser.add_argument("--threads", type=int, default=4)
parser.add_argument("--res-inside", default="", help="size of the frames inside the mound")
parser.add_argument("--samples-inside", type=int, default=0)
parser.add_argument("--coarse-first", action="store_true")
parser.add_argument(
    "--logo",
    default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "tex", "laf.png"),
)
args = parser.parse_args()

FRAME_COUNT = 120


def parse_frames(spec):
    out = []
    for part in spec.split(","):
        if "-" in part:
            a, b = part.split("-")
            step = 1
            if ":" in b:
                b, step = b.split(":")
            out.extend(range(int(a), int(b) + 1, int(step)))
        else:
            out.append(int(part))
    return out


FRAMES = parse_frames(args.frames)
RES_X, RES_Y = (int(v) for v in args.res.split("x"))
RNG = np.random.default_rng(11)

# ───────────────────────────── the stage ─────────────────────────────

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 0.01  # a unit is a centimetre

# The affogato stands at the origin, on the bar (z = 0). The mound of beans
# lies down the -Y side; the camera comes out of it travelling +Y.
TUNNEL_Y0 = -82.0  # the back of the tunnel
TUNNEL_Y1 = -46.0  # its mouth
TUNNEL_ZC = 5.2  # the height of its middle line over the bar
KEY_POS = Vector((-105.0, 150.0, 150.0))
KEY_AIM = Vector((0.0, -22.0, 2.0))


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def fbm(x, y, z, octaves=3):
    v = 0.0
    amp = 0.5
    f = 1.0
    for _ in range(octaves):
        v += amp * mnoise.noise(Vector((x * f, y * f, z * f)))
        amp *= 0.5
        f *= 2.03
    return v


def tunnel_centre(y):
    """The middle line: a slow S across, a slight swell up and down."""
    u = (y - TUNNEL_Y0) / (TUNNEL_Y1 - TUNNEL_Y0)
    x = 2.0 * math.sin(u * math.pi * 1.5 + 0.4) * (1 - 0.75 * u)
    z = TUNNEL_ZC + 0.3 * math.sin(u * math.pi * 2.3 + 0.6)
    return Vector((x, y, z))


ARCH_PERIOD = 9.0


def tunnel_radius(y, theta):
    """The wall: a bore that breathes, with a rib every nine centimetres."""
    u = (y - TUNNEL_Y0) / (TUNNEL_Y1 - TUNNEL_Y0)
    base = (
        5.0
        + 1.5 * fbm(y * 0.09, math.cos(theta) * 0.9, math.sin(theta) * 0.9, 2)
        + 0.45 * fbm(y * 0.3, math.cos(theta) * 2.2 + 7.0, math.sin(theta) * 2.2)
    )
    rib = max(0.0, math.cos((y - TUNNEL_Y0 - 3.0) / ARCH_PERIOD * 2 * math.pi)) ** 5
    base -= 0.95 * rib
    # The floor is flatter than the roof: a pile settles.
    floor = max(0.0, -math.sin(theta))
    base -= 0.9 * floor**2
    # It opens towards the mouth.
    base *= 1.0 + 0.55 * float(smoothstep(0.82, 1.0, u)) ** 1.5
    return base


# ───────────────────────────── materials ─────────────────────────────


def new_material(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    return mat, nodes, links, bsdf


def rgb(hex_string, alpha=1.0):
    """sRGB hex to the linear RGBA Blender wants."""
    h = hex_string.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, alpha)


def bean_material():
    mat, nodes, links, bsdf = new_material("bean")
    tint = nodes.new("ShaderNodeAttribute")
    tint.attribute_type = "INSTANCER"
    tint.attribute_name = "tint"
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = rgb("#1a0c06")
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = rgb("#4b2814")
    mid = ramp.color_ramp.elements.new(0.55)
    mid.color = rgb("#2f180c")
    links.new(tint.outputs["Fac"], ramp.inputs["Fac"])

    # The silverskin left in the crease: a paler line.
    crease = nodes.new("ShaderNodeAttribute")
    crease.attribute_type = "GEOMETRY"
    crease.attribute_name = "crease"
    line = nodes.new("ShaderNodeMapRange")
    line.inputs["From Min"].default_value = 0.55
    line.inputs["From Max"].default_value = 0.95
    line.inputs["To Min"].default_value = 0.0
    line.inputs["To Max"].default_value = 1.0
    links.new(crease.outputs["Fac"], line.inputs["Value"])
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["B"].default_value = rgb("#b98c58")
    links.new(line.outputs["Result"], mix.inputs["Factor"])
    links.new(ramp.outputs["Color"], mix.inputs["A"])

    # A mottled roast: slow noise in the bean's own space.
    coords = nodes.new("ShaderNodeTexCoord")
    mottle = nodes.new("ShaderNodeTexNoise")
    mottle.inputs["Scale"].default_value = 3.2
    mottle.inputs["Detail"].default_value = 3.0
    links.new(coords.outputs["Object"], mottle.inputs["Vector"])
    mottle_ramp = nodes.new("ShaderNodeValToRGB")
    mottle_ramp.color_ramp.elements[0].position = 0.3
    mottle_ramp.color_ramp.elements[0].color = (0.5, 0.5, 0.5, 1)
    mottle_ramp.color_ramp.elements[1].position = 0.75
    mottle_ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    links.new(mottle.outputs["Fac"], mottle_ramp.inputs["Fac"])
    mottle_mix = nodes.new("ShaderNodeMix")
    mottle_mix.data_type = "RGBA"
    mottle_mix.blend_type = "MULTIPLY"
    mottle_mix.inputs["Factor"].default_value = 0.55
    links.new(mix.outputs["Result"], mottle_mix.inputs["A"])
    links.new(mottle_ramp.outputs["Color"], mottle_mix.inputs["B"])
    links.new(mottle_mix.outputs["Result"], bsdf.inputs["Base Color"])

    # A dark roast sweats a little oil: a satin body under a thin coat.
    rough = nodes.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 0.36
    rough.inputs["To Max"].default_value = 0.56
    links.new(tint.outputs["Fac"], rough.inputs["Value"])
    links.new(rough.outputs["Result"], bsdf.inputs["Roughness"])
    bsdf.inputs["Coat Weight"].default_value = 0.14
    bsdf.inputs["Coat Roughness"].default_value = 0.22
    bsdf.inputs["Specular IOR Level"].default_value = 0.5

    # The fine wrinkle of a roasted skin.
    wrinkle = nodes.new("ShaderNodeTexNoise")
    wrinkle.inputs["Scale"].default_value = 24.0
    wrinkle.inputs["Detail"].default_value = 5.0
    wrinkle.inputs["Roughness"].default_value = 0.6
    links.new(coords.outputs["Object"], wrinkle.inputs["Vector"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.3
    bump.inputs["Distance"].default_value = 0.03
    links.new(wrinkle.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def shell_material():
    mat, nodes, links, bsdf = new_material("mound")
    bsdf.inputs["Base Color"].default_value = rgb("#0f0603")
    bsdf.inputs["Roughness"].default_value = 0.9
    return mat


def walnut_material():
    """The bar: oiled walnut, its boards running the way the camera goes."""
    mat, nodes, links, bsdf = new_material("walnut")
    coords = nodes.new("ShaderNodeTexCoord")

    # Long figure along Y.
    stretch = nodes.new("ShaderNodeMapping")
    stretch.inputs["Scale"].default_value = (1.4, 0.07, 1.4)
    links.new(coords.outputs["Object"], stretch.inputs["Vector"])
    figure = nodes.new("ShaderNodeTexNoise")
    figure.inputs["Scale"].default_value = 0.55
    figure.inputs["Detail"].default_value = 6.0
    figure.inputs["Roughness"].default_value = 0.62
    figure.inputs["Distortion"].default_value = 0.6
    links.new(stretch.outputs["Vector"], figure.inputs["Vector"])

    fine_map = nodes.new("ShaderNodeMapping")
    fine_map.inputs["Scale"].default_value = (7.0, 0.12, 7.0)
    links.new(coords.outputs["Object"], fine_map.inputs["Vector"])
    fine = nodes.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = 1.0
    fine.inputs["Detail"].default_value = 3.0
    links.new(fine_map.outputs["Vector"], fine.inputs["Vector"])

    blend = nodes.new("ShaderNodeMix")
    blend.data_type = "FLOAT"
    blend.inputs["Factor"].default_value = 0.28
    links.new(figure.outputs["Fac"], blend.inputs["A"])
    links.new(fine.outputs["Fac"], blend.inputs["B"])

    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.28
    ramp.color_ramp.elements[0].color = rgb("#160b05")
    ramp.color_ramp.elements[1].position = 0.78
    ramp.color_ramp.elements[1].color = rgb("#553318")
    mid = ramp.color_ramp.elements.new(0.52)
    mid.color = rgb("#2e190c")
    links.new(blend.outputs["Result"], ramp.inputs["Fac"])

    # The joints between boards: a dark hairline every 14 cm.
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(coords.outputs["Object"], sep.inputs["Vector"])
    wrap = nodes.new("ShaderNodeMath")
    wrap.operation = "PINGPONG"
    wrap.inputs[1].default_value = 7.0
    links.new(sep.outputs["X"], wrap.inputs[0])
    joint = nodes.new("ShaderNodeMapRange")
    joint.inputs["From Min"].default_value = 0.0
    joint.inputs["From Max"].default_value = 0.09
    joint.inputs["To Min"].default_value = 0.25
    joint.inputs["To Max"].default_value = 1.0
    links.new(wrap.outputs[0], joint.inputs["Value"])
    darken = nodes.new("ShaderNodeMix")
    darken.data_type = "RGBA"
    darken.blend_type = "MULTIPLY"
    darken.inputs["Factor"].default_value = 1.0
    links.new(ramp.outputs["Color"], darken.inputs["A"])
    links.new(joint.outputs["Result"], darken.inputs["B"])
    links.new(darken.outputs["Result"], bsdf.inputs["Base Color"])

    rough = nodes.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 0.34
    rough.inputs["To Max"].default_value = 0.58
    links.new(blend.outputs["Result"], rough.inputs["Value"])
    links.new(rough.outputs["Result"], bsdf.inputs["Roughness"])
    bsdf.inputs["Specular IOR Level"].default_value = 0.5
    bsdf.inputs["Coat Weight"].default_value = 0.08
    bsdf.inputs["Coat Roughness"].default_value = 0.3

    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12
    bump.inputs["Distance"].default_value = 0.05
    links.new(blend.outputs["Result"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def cookie_material():
    """The cup: a baked biscuit, coarse, darker where the oven caught it."""
    mat, nodes, links, bsdf = new_material("cookie")
    coords = nodes.new("ShaderNodeTexCoord")
    grain = nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 2.2
    grain.inputs["Detail"].default_value = 6.0
    grain.inputs["Roughness"].default_value = 0.7
    links.new(coords.outputs["Object"], grain.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.25
    ramp.color_ramp.elements[0].color = rgb("#8a5626")
    ramp.color_ramp.elements[1].position = 0.8
    ramp.color_ramp.elements[1].color = rgb("#c89655")
    links.new(grain.outputs["Fac"], ramp.inputs["Fac"])

    speck = nodes.new("ShaderNodeTexVoronoi")
    speck.inputs["Scale"].default_value = 9.0
    links.new(coords.outputs["Object"], speck.inputs["Vector"])
    speck_ramp = nodes.new("ShaderNodeValToRGB")
    speck_ramp.color_ramp.elements[0].position = 0.0
    speck_ramp.color_ramp.elements[0].color = (0.5, 0.5, 0.5, 1)
    speck_ramp.color_ramp.elements[1].position = 0.25
    speck_ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    links.new(speck.outputs["Distance"], speck_ramp.inputs["Fac"])
    mul = nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 0.75
    links.new(ramp.outputs["Color"], mul.inputs["A"])
    links.new(speck_ramp.outputs["Color"], mul.inputs["B"])
    links.new(mul.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.84
    bsdf.inputs["Specular IOR Level"].default_value = 0.3

    fine = nodes.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = 14.0
    fine.inputs["Detail"].default_value = 5.0
    links.new(coords.outputs["Object"], fine.inputs["Vector"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.7
    bump.inputs["Distance"].default_value = 0.06
    links.new(fine.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def sleeve_material():
    """The paper sleeve, with the L'Af mark on the side that faces us."""
    mat, nodes, links, bsdf = new_material("sleeve")
    paper = rgb("#f1ebe0")
    bsdf.inputs["Roughness"].default_value = 0.6
    bsdf.inputs["Specular IOR Level"].default_value = 0.35
    if not os.path.exists(args.logo):
        bsdf.inputs["Base Color"].default_value = paper
        return mat
    image = bpy.data.images.load(args.logo)
    uv = nodes.new("ShaderNodeTexCoord")
    place = nodes.new("ShaderNodeMapping")
    # lathe(): u runs round the cup (0.75 faces -Y, the camera), v up the
    # outer face (0 .. ~0.5).
    width_u, height_v = 0.168, 0.34
    centre_u, centre_v = 0.75, 0.262
    place.inputs["Scale"].default_value = (1 / width_u, 1 / height_v, 1.0)
    place.inputs["Location"].default_value = (
        -(centre_u - width_u / 2) / width_u,
        -(centre_v - height_v / 2) / height_v,
        0.0,
    )
    links.new(uv.outputs["UV"], place.inputs["Vector"])
    mark = nodes.new("ShaderNodeTexImage")
    mark.image = image
    mark.extension = "CLIP"
    mark.interpolation = "Cubic"
    links.new(place.outputs["Vector"], mark.inputs["Vector"])
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = paper
    links.new(mark.outputs["Alpha"], mix.inputs["Factor"])
    links.new(mark.outputs["Color"], mix.inputs["B"])
    links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    return mat


def bamboo_material():
    """The coaster: pale bamboo, its grain running one way."""
    mat, nodes, links, bsdf = new_material("bamboo")
    coords = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (0.35, 5.5, 5.5)
    links.new(coords.outputs["Object"], mapping.inputs["Vector"])
    grain = nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 2.4
    grain.inputs["Detail"].default_value = 5.0
    links.new(mapping.outputs["Vector"], grain.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[0].color = rgb("#a9783c")
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = rgb("#d9b274")
    links.new(grain.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.46
    return mat


def gelato_material():
    """Fior di latte: milk white, light going a little way into it."""
    mat, nodes, links, bsdf = new_material("gelato")
    bsdf.inputs["Base Color"].default_value = rgb("#f7ecd6")
    bsdf.inputs["Roughness"].default_value = 0.44
    bsdf.inputs["Subsurface Weight"].default_value = 1.0
    bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.75, 0.5)
    bsdf.inputs["Subsurface Scale"].default_value = 0.45
    bsdf.inputs["Specular IOR Level"].default_value = 0.5
    coords = nodes.new("ShaderNodeTexCoord")
    fine = nodes.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = 2.6
    fine.inputs["Detail"].default_value = 6.0
    fine.inputs["Roughness"].default_value = 0.65
    links.new(coords.outputs["Object"], fine.inputs["Vector"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.12
    links.new(fine.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def espresso_material(name="espresso", clear=0.0):
    """Espresso as it lies on the gelato: near black, wet."""
    mat, nodes, links, bsdf = new_material(name)
    bsdf.inputs["Base Color"].default_value = rgb("#210e05")
    bsdf.inputs["Roughness"].default_value = 0.07
    bsdf.inputs["Specular IOR Level"].default_value = 0.6
    bsdf.inputs["Coat Weight"].default_value = 0.4
    bsdf.inputs["Coat Roughness"].default_value = 0.04
    if clear > 0:
        bsdf.inputs["Base Color"].default_value = rgb("#6b3210")
        bsdf.inputs["Transmission Weight"].default_value = clear
        bsdf.inputs["IOR"].default_value = 1.34
        bsdf.inputs["Roughness"].default_value = 0.03
        bsdf.inputs["Coat Weight"].default_value = 0.0
    return mat


def bulb_material(name, colour, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    for node in list(nodes):
        nodes.remove(node)
    out = nodes.new("ShaderNodeOutputMaterial")
    emit = nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = rgb(colour)
    emit.inputs["Strength"].default_value = strength
    links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


# ───────────────────────────── geometry ─────────────────────────────


def mesh_object(name, verts, faces, material=None, smooth=True, uvs=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.update()
    if smooth:
        mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
    if uvs is not None:
        layer = mesh.uv_layers.new(name="UVMap")
        flat = []
        for poly in mesh.polygons:
            for li in poly.loop_indices:
                flat.extend(uvs[mesh.loops[li].vertex_index])
        layer.data.foreach_set("uv", flat)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    if material is not None:
        mesh.materials.append(material)
    return obj


def subdivide(obj, levels=1):
    mod = obj.modifiers.new("subdivision", "SUBSURF")
    mod.levels = levels
    mod.render_levels = levels
    return mod


def bean_mesh(seed):
    """One roasted bean: a domed back, a flat belly with its S-shaped crease.
    Long axis Y, the belly faces -Z."""
    rng = np.random.default_rng(seed)
    length = 1.08 + rng.uniform(-0.1, 0.1)
    width = 0.78 + rng.uniform(-0.06, 0.06)
    dome = 0.36 + rng.uniform(-0.03, 0.03)
    belly = 0.16 + rng.uniform(-0.02, 0.02)
    bend = rng.uniform(-0.05, 0.05)
    sway = rng.uniform(0.10, 0.17) * rng.choice([-1, 1])
    around, along = 64, 30
    verts, crease = [], []
    faces = []

    def shape(alpha, phi):
        # A superellipsoid: blunt ends, a full shoulder.
        sa = math.sin(alpha) ** 0.8
        sx = sa * math.cos(phi)
        sy = math.cos(alpha)
        sz = sa * math.sin(phi)
        v = math.copysign(abs(sy) ** 0.9, sy)
        x = sx * width / 2
        y = v * length / 2
        z = sz * (dome if sz >= 0 else belly)
        u = sx
        groove = 0.0
        if sz < 0:
            centre = sway * math.sin(v * 2.3)
            groove = math.exp(-(((u - centre) / 0.15) ** 2)) * (1 - abs(v) ** 5)
            z += groove * 0.3 * min(1.0, -sz * 3.0)
        x += bend * (v * v - 0.5)
        return (x, y, z), groove

    verts.append(shape(0.0, 0.0)[0])
    crease.append(0.0)
    for i in range(1, along):
        alpha = math.pi * i / along
        for j in range(around):
            phi = 2 * math.pi * j / around
            p, g = shape(alpha, phi)
            verts.append(p)
            crease.append(g)
    verts.append(shape(math.pi, 0.0)[0])
    crease.append(0.0)
    last = len(verts) - 1
    for j in range(around):
        faces.append((0, 1 + (j + 1) % around, 1 + j))
    for i in range(along - 2):
        a = 1 + i * around
        b = a + around
        for j in range(around):
            jn = (j + 1) % around
            faces.append((a + j, a + jn, b + jn, b + j))
    base = 1 + (along - 2) * around
    for j in range(around):
        faces.append((last, base + j, base + (j + 1) % around))

    mesh = bpy.data.meshes.new(f"bean-{seed}")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
    attr = mesh.attributes.new("crease", "FLOAT", "POINT")
    attr.data.foreach_set("value", crease)
    return mesh


def lathe(name, profile, segments, material):
    """Turn a (radius, height) outline about Z. UV: u round, v along."""
    verts, uvs = [], []
    lengths = [0.0]
    for a, b in zip(profile, profile[1:]):
        lengths.append(lengths[-1] + math.dist(a, b))
    total = lengths[-1] or 1.0
    for k, (r, z) in enumerate(profile):
        for j in range(segments + 1):
            ang = 2 * math.pi * j / segments
            verts.append((r * math.cos(ang), r * math.sin(ang), z))
            uvs.append((j / segments, lengths[k] / total))
    faces = []
    row = segments + 1
    for k in range(len(profile) - 1):
        for j in range(segments):
            a = k * row + j
            faces.append((a, a + 1, a + row + 1, a + row))
    obj = mesh_object(name, verts, faces, material, uvs=uvs)
    # Close the seam so smoothing runs across it.
    weld = obj.modifiers.new("weld", "WELD")
    weld.merge_threshold = 0.0005
    return obj


def cup_outer_radius(z):
    """The cup's outside, from its foot (z = 0) to its lip (z = 8.5)."""
    return 3.25 + (4.08 - 3.25) * (z / 8.5)


def build_affogato():
    """The affogato: bamboo coaster, the biscuit cup in its paper sleeve,
    scoops of fior di latte and the espresso that has just been poured over
    them."""
    base_z = 0.72  # the coaster's recess

    coaster = lathe(
        "coaster",
        [
            (0.001, 0.0),
            (6.05, 0.0),
            (6.22, 0.12),
            (6.25, 0.5),
            (6.22, 0.9),
            (6.05, 1.0),
            (5.55, 1.0),
            (5.4, 0.92),
            (5.32, base_z),
            (0.001, base_z),
        ],
        96,
        bamboo_material(),
    )
    subdivide(coaster)

    wall = 0.5
    cup_profile = [(0.001, 0.0), (3.05, 0.0), (3.22, 0.06), (3.27, 0.25)]
    for k in range(1, 12):
        z = 0.25 + (8.2 - 0.25) * k / 12
        cup_profile.append((cup_outer_radius(z), z))
    cup_profile += [
        (4.08, 8.25),
        (4.07, 8.45),
        (3.98, 8.6),
        (3.84, 8.66),
        (3.7, 8.6),
        (3.6, 8.45),
        (3.57, 8.2),
    ]
    for k in range(1, 10):
        z = 8.2 - (8.2 - 0.9) * k / 10
        cup_profile.append((cup_outer_radius(z) - wall, z))
    cup_profile += [(2.6, 0.62), (0.001, 0.58)]
    cup = lathe("cup", cup_profile, 128, cookie_material())
    cup.location.z = base_z
    subdivide(cup)
    # The hand-pressed wobble of a baked cup.
    wobble = bpy.data.textures.new("cup-wobble", "CLOUDS")
    wobble.noise_scale = 1.4
    disp = cup.modifiers.new("wobble", "DISPLACE")
    disp.texture = wobble
    disp.strength = 0.07
    disp.mid_level = 0.5

    sleeve_profile = []
    z0, z1 = 0.4, 4.9
    for k in range(9):
        z = z0 + (z1 - z0) * k / 8
        sleeve_profile.append((cup_outer_radius(z) + 0.06, z))
    for k in range(9):
        z = z1 - (z1 - z0) * k / 8
        sleeve_profile.append((cup_outer_radius(z) + 0.015, z))
    sleeve = lathe("sleeve", sleeve_profile, 128, sleeve_material())
    sleeve.location.z = base_z

    # The gelato.
    gelato = gelato_material()
    sauce = espresso_material()
    lip = base_z + 8.6
    scoops = [
        # centre, radius
        (Vector((-0.5, -0.9, lip + 0.75)), 2.7),
        (Vector((1.35, 0.7, lip + 0.3)), 2.4),
        (Vector((-1.45, 1.25, lip + 0.0)), 2.2),
    ]

    for index, (centre, radius) in enumerate(scoops):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=6, radius=1.0)
        bm.verts.ensure_lookup_table()
        seed = 13.7 * (index + 1)
        base_dirs = [v.co.normalized() for v in bm.verts]
        reach = []
        for v, n in zip(bm.verts, base_dirs):
            lumps = fbm(n.x * 1.5 + seed, n.y * 1.5, n.z * 1.5, 3)
            ridges = fbm(n.x * 4.6, n.y * 4.6 + seed, n.z * 4.6, 3)
            r = radius * (1.0 + 0.11 * lumps + 0.035 * ridges)
            p = n * r
            # Flattened where it sits in the cup.
            if p.z < -radius * 0.35:
                p.z = -radius * 0.35 + (p.z + radius * 0.35) * 0.35
            v.co = p
            theta = math.atan2(n.y, n.x)
            reach.append(
                0.2
                + 0.9
                * fbm(math.cos(theta) * 2.1 + seed, math.sin(theta) * 2.1, seed, 2)
            )
        mesh = bpy.data.meshes.new(f"scoop-{index}")
        bm.to_mesh(mesh)
        mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
        mesh.materials.append(gelato)
        obj = bpy.data.objects.new(f"scoop-{index}", mesh)
        obj.location = centre
        scene.collection.objects.link(obj)

        # The espresso lying on it: the crown, and the runs down its sides.
        keep = set()
        for face in bm.faces:
            ok = True
            for v in face.verts:
                n = base_dirs[v.index]
                limit = 0.5 - 1.0 * max(0.0, reach[v.index])
                if index > 0:
                    limit += 0.3
                if n.z < limit:
                    ok = False
                    break
            if ok:
                keep.add(face)
        drop = [f for f in bm.faces if f not in keep]
        bmesh.ops.delete(bm, geom=drop, context="FACES")
        for v in bm.verts:
            v.co += v.co.normalized() * 0.05
        sauce_mesh = bpy.data.meshes.new(f"sauce-{index}")
        bm.to_mesh(sauce_mesh)
        bm.free()
        sauce_mesh.polygons.foreach_set("use_smooth", [True] * len(sauce_mesh.polygons))
        sauce_mesh.materials.append(sauce)
        sauce_obj = bpy.data.objects.new(f"sauce-{index}", sauce_mesh)
        sauce_obj.location = centre
        scene.collection.objects.link(sauce_obj)
        solid = sauce_obj.modifiers.new("body", "SOLIDIFY")
        solid.thickness = 0.08
        solid.offset = 1.0

    # What has run off and pooled inside the lip.
    pool = lathe("pool", [(0.001, 0.0), (3.52, 0.0)], 64, sauce)
    pool.location.z = lip - 0.7


def build_bar():
    half_x, y_near, y_far, thick = 62.0, -150.0, 105.0, 4.0
    verts = [
        (-half_x, y_near, 0),
        (half_x, y_near, 0),
        (half_x, y_far, 0),
        (-half_x, y_far, 0),
        (-half_x, y_near, -thick),
        (half_x, y_near, -thick),
        (half_x, y_far, -thick),
        (-half_x, y_far, -thick),
    ]
    faces = [
        (0, 1, 2, 3),
        (7, 6, 5, 4),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ]
    bar = mesh_object("bar", verts, faces, walnut_material(), smooth=False)
    bevel = bar.modifiers.new("edge", "BEVEL")
    bevel.width = 0.6
    bevel.segments = 4


def build_string_lights():
    """The terrace's string lights, far behind the cup: with the lens open
    they are soft discs of amber."""
    mats = [
        bulb_material("bulb-amber", "#ff9a3c", 3.4),
        bulb_material("bulb-warm", "#ffc27a", 2.7),
        bulb_material("bulb-ember", "#f26a22", 3.0),
    ]
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
    meshes = []
    for mat in mats:
        mesh = bpy.data.meshes.new(f"{mat.name}-mesh")
        bm.to_mesh(mesh)
        mesh.materials.append(mat)
        mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
        meshes.append(mesh)
    bm.free()
    rng = np.random.default_rng(5)
    count = 0

    def bulb(pos, size):
        nonlocal count
        mesh = meshes[int(rng.choice([0, 0, 0, 1, 1, 2]))]
        obj = bpy.data.objects.new(f"bulb-{count}", mesh)
        obj.location = pos
        obj.scale = (size, size, size)
        scene.collection.objects.link(obj)
        obj.visible_diffuse = False
        obj.visible_shadow = False
        count += 1

    # Swags across the terrace at four depths.
    for depth, (y, z0, sag, n, size) in enumerate(
        [
            (190.0, 62.0, 16.0, 9, 4.2),
            (260.0, 96.0, 22.0, 11, 5.4),
            (350.0, 70.0, 18.0, 12, 6.6),
            (460.0, 128.0, 30.0, 13, 8.4),
        ]
    ):
        x0 = -260.0 - depth * 40 + rng.uniform(-20, 20)
        x1 = 260.0 + depth * 40 + rng.uniform(-20, 20)
        tilt = rng.uniform(-14, 14)
        for i in range(n):
            u = (i + rng.uniform(-0.18, 0.18)) / (n - 1)
            x = x0 + (x1 - x0) * u
            z = z0 + tilt * (u - 0.5) - sag * math.sin(math.pi * u)
            bulb((x, y + rng.uniform(-8, 8), z), size * rng.uniform(0.82, 1.15))
    # Low lights beyond the bar: a window, candles on far tables.
    for _ in range(16):
        y = rng.uniform(240, 520)
        bulb(
            (rng.uniform(-330, 330), y, rng.uniform(6, 42)),
            rng.uniform(2.8, 6.0) * (y / 300),
        )


def build_beans():
    """The mound's tunnel wall, three beans deep, and the beans that have
    rolled out of its mouth along the bar."""
    variants = bpy.data.collections.new("bean-variants")
    scene.collection.children.link(variants)
    mat = bean_material()
    count = 6
    for seed in range(count):
        mesh = bean_mesh(100 + seed)
        mesh.materials.append(mat)
        obj = bpy.data.objects.new(f"bean-{seed}", mesh)
        variants.objects.link(obj)
        subdivide(obj)
    # Instances only: the originals are not drawn.
    variants.hide_render = True
    variants.hide_viewport = True

    positions, rotations, scales, tints, kinds = [], [], [], [], []

    def add(pos, z_axis, spin, tilt=0.0):
        z_axis = Vector(z_axis).normalized()
        helper = Vector((0, 0, 1)) if abs(z_axis.z) < 0.9 else Vector((1, 0, 0))
        x_axis = z_axis.cross(helper).normalized()
        y_axis = z_axis.cross(x_axis).normalized()
        basis = Matrix((x_axis, y_axis, z_axis)).transposed()
        rot = basis @ Matrix.Rotation(spin, 3, "Z")
        if tilt:
            axis_angle = RNG.uniform(0, 2 * math.pi)
            axis = Vector((math.cos(axis_angle), math.sin(axis_angle), 0.0))
            rot = rot @ Matrix.Rotation(tilt, 3, axis)
        euler = rot.to_euler("XYZ")
        positions.append(tuple(pos))
        rotations.append((euler.x, euler.y, euler.z))
        s = RNG.uniform(0.9, 1.12)
        scales.append((s * RNG.uniform(0.94, 1.06), s, s * RNG.uniform(0.92, 1.08)))
        tints.append(float(np.clip(RNG.normal(0.45, 0.24), 0.0, 1.0)))
        kinds.append(int(RNG.integers(0, count)))

    # The gaps: places in the roof where the lamp comes down into the bore.
    leaks = [
        (-77.0, 1.75, 2.2),
        (-70.0, 2.25, 2.0),
        (-63.5, 1.6, 2.6),
        (-57.0, 2.15, 2.2),
        (-51.5, 1.7, 2.8),
    ]

    def in_leak(y, theta, r):
        for ly, lt, lr in leaks:
            d_theta = (theta - lt + math.pi) % (2 * math.pi) - math.pi
            if math.hypot(y - ly, d_theta * r) < lr:
                return True
        return False

    y = TUNNEL_Y0
    while y < TUNNEL_Y1 + 2.0:
        for layer in range(3):
            r_mid = tunnel_radius(y, 0.0) + layer * 0.45
            n = int(2 * math.pi * r_mid / 0.6)
            offset = RNG.uniform(0, 2 * math.pi)
            for j in range(n):
                theta = offset + 2 * math.pi * (j + RNG.uniform(-0.3, 0.3)) / n
                yy = y + RNG.uniform(-0.26, 0.26)
                c = tunnel_centre(yy)
                r = tunnel_radius(yy, theta) + layer * 0.45 + RNG.uniform(-0.16, 0.2)
                if in_leak(yy, theta % (2 * math.pi), r) and RNG.random() > 0.06:
                    continue
                outward = Vector((math.cos(theta), 0.0, math.sin(theta)))
                pos = c + outward * r
                if pos.z < 0.22:
                    pos.z = 0.22 + RNG.uniform(0, 0.12)
                facing = -outward if RNG.random() < 0.42 else outward
                add(
                    pos,
                    facing,
                    RNG.uniform(0, 2 * math.pi),
                    tilt=float(RNG.normal(0, 0.4)),
                )
        y += 0.5

    # Out of the mouth: a fan along the bar, thinning towards the cup.
    made = 0
    attempts = 0
    while made < 460 and attempts < 20000:
        attempts += 1
        d = abs(RNG.normal(0, 13.0))
        yy = TUNNEL_Y1 + d - 1.5
        spread = 3.5 + d * 0.75
        xx = tunnel_centre(TUNNEL_Y1).x + RNG.normal(0, spread)
        if math.hypot(xx, yy) < 8.6:
            continue
        if yy > 32 or abs(xx) > 56:
            continue
        add(
            (xx, yy, 0.17 + RNG.uniform(0, 0.03)),
            (0, 0, -1) if RNG.random() < 0.55 else (0, 0, 1),
            RNG.uniform(0, 2 * math.pi),
            tilt=float(RNG.normal(0, 0.07)),
        )
        made += 1
    # And the heap at the mouth itself, on the bar either side of the way.
    for _ in range(950):
        ang = RNG.uniform(0, math.pi)
        dist = RNG.uniform(4.6, 11.0)
        base = tunnel_centre(TUNNEL_Y1 + 1.0)
        px = base.x + math.cos(ang) * dist * (1 if RNG.random() < 0.5 else -1)
        py = TUNNEL_Y1 + 1.0 + RNG.uniform(-3.0, 4.5) - abs(math.cos(ang)) * 1.5
        height = max(0.0, 5.6 - (dist - 4.6) * 0.85) * RNG.uniform(0.0, 1.0)
        if abs(px - base.x) < 5.2 and height > 1.2:
            height = RNG.uniform(0.0, 1.2)
        add(
            (px, py, 0.2 + height),
            (RNG.normal(0, 0.5), RNG.normal(0, 0.5), 1.0),
            RNG.uniform(0, 2 * math.pi),
            tilt=float(RNG.normal(0, 0.3)),
        )

    total = len(positions)
    mesh = bpy.data.meshes.new("bean-points")
    mesh.from_pydata(positions, [], [])
    mesh.update()
    rot_attr = mesh.attributes.new("rot", "FLOAT_VECTOR", "POINT")
    rot_attr.data.foreach_set("vector", np.array(rotations, dtype=np.float32).ravel())
    scl_attr = mesh.attributes.new("scl", "FLOAT_VECTOR", "POINT")
    scl_attr.data.foreach_set("vector", np.array(scales, dtype=np.float32).ravel())
    tint_attr = mesh.attributes.new("tint", "FLOAT", "POINT")
    tint_attr.data.foreach_set("value", np.array(tints, dtype=np.float32))
    kind_attr = mesh.attributes.new("kind", "INT", "POINT")
    kind_attr.data.foreach_set("value", np.array(kinds, dtype=np.int32))
    holder = bpy.data.objects.new("beans", mesh)
    scene.collection.objects.link(holder)

    group = bpy.data.node_groups.new("scatter-beans", "GeometryNodeTree")
    group.interface.new_socket(
        name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry"
    )
    group.interface.new_socket(
        name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry"
    )
    n = group.nodes
    l = group.links
    g_in = n.new("NodeGroupInput")
    g_out = n.new("NodeGroupOutput")
    to_points = n.new("GeometryNodeMeshToPoints")
    inst = n.new("GeometryNodeInstanceOnPoints")
    coll = n.new("GeometryNodeCollectionInfo")
    coll.inputs["Collection"].default_value = variants
    coll.inputs["Separate Children"].default_value = True
    coll.inputs["Reset Children"].default_value = True
    rot = n.new("GeometryNodeInputNamedAttribute")
    rot.data_type = "FLOAT_VECTOR"
    rot.inputs["Name"].default_value = "rot"
    scl = n.new("GeometryNodeInputNamedAttribute")
    scl.data_type = "FLOAT_VECTOR"
    scl.inputs["Name"].default_value = "scl"
    kind = n.new("GeometryNodeInputNamedAttribute")
    kind.data_type = "INT"
    kind.inputs["Name"].default_value = "kind"
    to_rot = n.new("FunctionNodeEulerToRotation")
    l.new(g_in.outputs[0], to_points.inputs["Mesh"])
    l.new(to_points.outputs["Points"], inst.inputs["Points"])
    l.new(coll.outputs[0], inst.inputs["Instance"])
    inst.inputs["Pick Instance"].default_value = True
    l.new(kind.outputs["Attribute"], inst.inputs["Instance Index"])
    l.new(rot.outputs["Attribute"], to_rot.inputs[0])
    l.new(to_rot.outputs[0], inst.inputs["Rotation"])
    l.new(scl.outputs["Attribute"], inst.inputs["Scale"])
    l.new(inst.outputs["Instances"], g_out.inputs[0])
    mod = holder.modifiers.new("scatter", "NODES")
    mod.node_group = group
    print(f"beans: {total}")

    # Behind the beans: the dark of the mound, which also keeps the lamp out
    # except at the gaps.
    segs = 72
    verts, faces, gap_faces = [], [], []
    ys = np.arange(TUNNEL_Y0 - 1.0, TUNNEL_Y1 + 2.01, 0.75)
    for yy in ys:
        c = tunnel_centre(float(yy))
        for j in range(segs):
            theta = 2 * math.pi * j / segs
            r = tunnel_radius(float(yy), theta) + 1.5
            p = c + Vector((math.cos(theta), 0.0, math.sin(theta))) * r
            p.z = max(p.z, -0.2)
            verts.append(tuple(p))
    for k in range(len(ys) - 1):
        for j in range(segs):
            theta = 2 * math.pi * (j + 0.5) / segs
            yy = float(ys[k]) + 0.375
            a = k * segs + j
            b = k * segs + (j + 1) % segs
            if in_leak(yy, theta, tunnel_radius(yy, theta) + 1.5):
                gap_faces.append((a, b, b + segs, a + segs))
                continue
            faces.append((a, b, b + segs, a + segs))
    # The back wall.
    back = len(verts)
    verts.append(tuple(tunnel_centre(TUNNEL_Y0 - 1.0)))
    for j in range(segs):
        faces.append((back, (j + 1) % segs, j))
    shell = shell_material()
    mesh_object("mound", verts, faces, shell)
    # The gaps are dark to the lens too, but they throw no shadow: the lamp
    # comes through them, the night outside does not show.
    gaps = mesh_object("mound-gaps", verts, gap_faces, shell)
    gaps.visible_shadow = False


# ───────────────────────────── light ─────────────────────────────


def aim(obj, target):
    direction = (Vector(target) - obj.location).normalized()
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def build_light():
    world = bpy.data.worlds.new("night")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.05, 0.028, 0.016, 1.0)
    background.inputs["Strength"].default_value = 0.35

    # The key: a warm lamp high behind the cup, raking the bar towards us.
    key_data = bpy.data.lights.new("key", "SPOT")
    key_data.energy = 5.2e6
    key_data.spot_size = math.radians(54)
    key_data.spot_blend = 0.85
    key_data.shadow_soft_size = 26.0
    key_data.color = (1.0, 0.78, 0.55)
    key = bpy.data.objects.new("key", key_data)
    key.location = KEY_POS
    scene.collection.objects.link(key)
    key.visible_camera = False
    aim(key, KEY_AIM)

    # The fill: a broad soft light from the camera's right, a fifth of it.
    fill_data = bpy.data.lights.new("fill", "AREA")
    fill_data.shape = "RECTANGLE"
    fill_data.size = 90.0
    fill_data.size_y = 60.0
    fill_data.energy = 2.2e4
    fill_data.color = (1.0, 0.86, 0.72)
    fill = bpy.data.objects.new("fill", fill_data)
    fill.location = (70.0, -62.0, 58.0)
    scene.collection.objects.link(fill)
    fill.visible_camera = False
    aim(fill, (0.0, 0.0, 7.0))

    # A small top light: the shine on the espresso, the glow in the gelato.
    top_data = bpy.data.lights.new("top", "AREA")
    top_data.shape = "DISK"
    top_data.size = 16.0
    top_data.energy = 2.8e3
    top_data.color = (1.0, 0.9, 0.8)
    top = bpy.data.objects.new("top", top_data)
    top.location = (-6.0, 8.0, 46.0)
    scene.collection.objects.link(top)
    top.visible_camera = False
    top.visible_glossy = False
    aim(top, (0.0, 0.0, 10.0))

    # Mist: the depth map is made from it.
    world.mist_settings.start = 0.0
    world.mist_settings.depth = 400.0
    world.mist_settings.falloff = "LINEAR"


# ───────────────────────────── camera ─────────────────────────────

CUP_TARGET = Vector((0.0, 0.0, 6.3))

# The way, as (scroll, y): most of it inside the mound, out of the mouth at
# about 0.62, then a long slow push in on the cup.
if args.portrait:
    WAY = [
        (0.0, -75.0),
        (0.3, -63.0),
        (0.55, -51.0),
        (0.64, -45.5),
        (0.8, -37.0),
        (0.93, -34.2),
        (1.0, -33.6),
    ]
else:
    WAY = [
        (0.0, -75.0),
        (0.3, -63.0),
        (0.55, -51.0),
        (0.64, -45.5),
        (0.8, -34.0),
        (0.93, -30.7),
        (1.0, -30.0),
    ]
_way = PchipInterpolator([p[0] for p in WAY], [p[1] for p in WAY])
END_Y = WAY[-1][1]


def camera_pose(t):
    y = float(_way(t))
    inside = 1.0 - float(smoothstep(TUNNEL_Y1 - 6.0, TUNNEL_Y1 + 5.0, y))
    line = tunnel_centre(min(y, TUNNEL_Y1))
    out_height = 6.9 if not args.portrait else 7.4
    rise = float(smoothstep(TUNNEL_Y1 - 4.0, END_Y, y))
    pos = Vector(
        (
            line.x * inside * 0.75,
            y,
            (line.z - 0.55) * (1 - rise) + out_height * rise,
        )
    )
    ahead = tunnel_centre(min(y + 14.0, TUNNEL_Y1))
    ahead.z -= 0.4
    pull = 0.35 + 0.65 * (1.0 - inside)
    target = ahead.lerp(CUP_TARGET, pull)
    return pos, target


META = {}


def build_camera():
    data = bpy.data.cameras.new("probe")
    cam = bpy.data.objects.new("probe", data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    data.sensor_width = 36.0
    data.sensor_height = 24.0
    if args.portrait:
        data.sensor_fit = "VERTICAL"
        data.lens = 22.0
    else:
        data.sensor_fit = "HORIZONTAL"
        data.lens = 25.0
    data.clip_start = 0.05
    data.clip_end = 5000.0
    data.dof.use_dof = True
    data.dof.aperture_blades = 0

    # The probe's own lamp: a small soft ring round the lens.
    lamp_data = bpy.data.lights.new("probe-lamp", "AREA")
    lamp_data.shape = "DISK"
    lamp_data.size = 2.6
    lamp_data.color = (1.0, 0.86, 0.7)
    lamp = bpy.data.objects.new("probe-lamp", lamp_data)
    scene.collection.objects.link(lamp)
    lamp.parent = cam
    lamp.location = (0.0, 1.0, 0.6)
    lamp.visible_camera = False

    for frame in range(FRAME_COUNT):
        t = frame / (FRAME_COUNT - 1)
        pos, target = camera_pose(t)
        cam.location = pos
        direction = (target - pos).normalized()
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        cam.keyframe_insert("location", frame=frame)
        cam.keyframe_insert("rotation_euler", frame=frame)
        inside = 1.0 - float(smoothstep(TUNNEL_Y1 - 9.0, TUNNEL_Y1 + 4.0, pos.y))
        to_cup = (Vector((0.0, -3.0, 6.3)) - pos).length
        # Inside, the lens holds the beans a hand's width ahead; coming out
        # it racks to the cup and opens up.
        data.dof.focus_distance = 13.0 * inside + to_cup * (1.0 - inside)
        data.dof.keyframe_insert("focus_distance", frame=frame)
        data.dof.aperture_fstop = 2.4 + (13.0 - 2.4) * inside
        data.dof.keyframe_insert("aperture_fstop", frame=frame)
        lamp_data.energy = 2.0 + 210.0 * inside
        lamp_data.keyframe_insert("energy", frame=frame)
        META[frame] = {
            "inside": inside,
            "y": pos.y,
            "focus": data.dof.focus_distance,
        }
    return cam


# ───────────────────────────── render ─────────────────────────────


def configure_render():
    scene.render.engine = "CYCLES"
    c = scene.cycles
    c.device = "CPU"
    c.samples = args.samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = args.threshold
    c.adaptive_min_samples = min(24, args.samples)
    c.use_denoising = True
    c.denoiser = "OPENIMAGEDENOISE"
    c.denoising_input_passes = "RGB_ALBEDO_NORMAL"
    c.denoising_prefilter = "ACCURATE"
    c.max_bounces = 4
    c.diffuse_bounces = 2
    c.glossy_bounces = 2
    c.transmission_bounces = 6
    c.transparent_max_bounces = 6
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.sample_clamp_indirect = 8.0
    c.pixel_filter_type = "BLACKMAN_HARRIS"
    scene.render.threads_mode = "FIXED"
    scene.render.threads = args.threads
    scene.render.use_persistent_data = True
    scene.render.resolution_x = RES_X
    scene.render.resolution_y = RES_Y
    scene.render.resolution_percentage = 100
    settings = scene.render.image_settings
    if hasattr(settings, "media_type"):
        settings.media_type = "MULTI_LAYER_IMAGE"
    settings.file_format = "OPEN_EXR_MULTILAYER"
    settings.color_depth = "16"
    settings.exr_codec = "ZIP"
    layer = scene.view_layers[0]
    layer.use_pass_mist = True
    scene.frame_start = 0
    scene.frame_end = FRAME_COUNT - 1


started = time.time()
build_light()
build_bar()
build_string_lights()
build_affogato()
build_beans()
build_camera()
configure_render()
print(f"scene built in {time.time() - started:.1f}s")

os.makedirs(args.out, exist_ok=True)
with open(os.path.join(args.out, "meta.json"), "w") as handle:
    json.dump(META, handle)

if os.environ.get("SCENE_NO_RENDER"):
    FRAMES = []
if args.coarse_first:
    # Every 16th frame first, then every 8th, and so on: a whole (coarse)
    # journey exists early, and fills in.
    def rank(frame):
        for level, step in enumerate((16, 8, 4, 2, 1)):
            if frame % step == 0 or frame == FRAME_COUNT - 1:
                return (level if frame != FRAME_COUNT - 1 else 0, frame)
        return (9, frame)

    FRAMES = sorted(FRAMES, key=rank)
INSIDE_RES = tuple(int(v) for v in args.res_inside.split("x")) if args.res_inside else None
for frame in FRAMES:
    path = os.path.join(os.path.abspath(args.out), f"f{frame:03d}.exr")
    if os.path.exists(path):
        continue
    scene.frame_set(frame)
    # Deep inside the mound the picture is dark and soft: fewer samples and
    # bounces, and (after the landing frames) a smaller frame.
    dark = META[frame]["inside"] > 0.9
    deep = dark and frame > 5
    size = INSIDE_RES if (deep and INSIDE_RES) else (RES_X, RES_Y)
    scene.render.resolution_x, scene.render.resolution_y = size
    c = scene.cycles
    c.samples = args.samples_inside if (dark and args.samples_inside) else args.samples
    c.adaptive_threshold = args.threshold * (1.4 if dark else 1.0)
    c.max_bounces = 2 if dark else 4
    c.diffuse_bounces = 1 if dark else 2
    c.glossy_bounces = 1 if dark else 2
    scene.render.filepath = path
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"frame {frame}: {time.time() - t0:.1f}s", flush=True)
