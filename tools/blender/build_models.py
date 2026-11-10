"""Build the game's 3D models with Blender and export them as .glb.

    python tools/blender/build_models.py [out_dir]      default: public/models

Runs headless through the `bpy` module (pip install bpy), no Blender UI needed.
The models are generated from this script rather than hand-edited, so the .glb
files in public/models are build output: change the script, rerun, commit both.

Conventions the game relies on:
  - Characters stand on the origin and face Blender -Y, which the glTF exporter
    turns into +Z, the direction the game treats as "forward".
  - Structures are unit-sized (1 x 1 x 1, origin at bottom centre) and scaled by
    the game to whatever the stage layout says, so sizes live in one place.
"""

import math
import os
import sys

import bpy

OUT = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith(".py") else "public/models"


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, rgb, roughness=0.6, metallic=0.0, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*rgb, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission
    return mat


def box(size, loc, mat, bevel=0.06, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    obj.data.materials.append(mat)
    return obj


def ball(radius, loc, mat, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    return obj


def tube(radius, depth, loc, mat, rot=(0, 0, 0), vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    return obj


def export(name):
    bpy.ops.object.select_all(action="SELECT")
    path = os.path.join(OUT, f"{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_apply=True)
    print(f"[models] {path}  ({os.path.getsize(path) / 1024:.1f} KB)")


# ---- characters -------------------------------------------------------------

def fighter():
    """The player: a small brawler in a blue gi with red gloves and headband."""
    reset()
    gi = material("gi", (0.16, 0.42, 0.95))
    skin = material("skin", (1.0, 0.78, 0.6))
    red = material("red", (0.92, 0.16, 0.2), roughness=0.4)
    dark = material("dark", (0.1, 0.1, 0.16))

    box((0.62, 0.42, 0.6), (0, 0, 0.62), gi, bevel=0.12)            # torso
    box((0.64, 0.44, 0.1), (0, 0, 0.42), dark, bevel=0.03)           # belt
    ball(0.3, (0, 0, 1.2), skin)                                     # head
    tube(0.31, 0.09, (0, 0, 1.29), red)                              # headband
    box((0.5, 0.06, 0.08), (0, -0.27, 1.22), dark, bevel=0.02)       # brow: reads as "facing"
    for side in (-1, 1):
        ball(0.19, (side * 0.42, -0.32, 0.74), red)                  # gloves, guard up
        box((0.2, 0.3, 0.3), (side * 0.17, 0, 0.16), dark, bevel=0.06)  # feet
    export("fighter")


def grunt():
    """Melee enemy: wide, heavy, oversized fists."""
    reset()
    body = material("body", (0.78, 0.2, 0.26))
    belly = material("belly", (0.95, 0.55, 0.3))
    dark = material("dark", (0.3, 0.05, 0.1))
    eye = material("eye", (1.0, 0.95, 0.3), emission=2.0)

    box((0.86, 0.6, 0.8), (0, 0, 0.72), body, bevel=0.18)
    box((0.5, 0.1, 0.42), (0, -0.28, 0.66), belly, bevel=0.05)
    ball(0.27, (0, -0.04, 1.32), body)
    box((0.42, 0.08, 0.1), (0, -0.26, 1.38), dark, bevel=0.02, rot=(0, 0, 0))
    for side in (-1, 1):
        ball(0.05, (side * 0.1, -0.25, 1.3), eye)
        ball(0.27, (side * 0.6, -0.3, 0.72), dark)                   # fists
        box((0.28, 0.36, 0.34), (side * 0.22, 0, 0.17), dark, bevel=0.06)
        box((0.1, 0.1, 0.2), (side * 0.18, 0.02, 1.58), dark, bevel=0.03,
            rot=(0, side * 0.35, 0))                                 # horns
    export("grunt")


def shooter():
    """Ranged enemy: slim, visor instead of eyes, an arm cannon."""
    reset()
    body = material("body", (0.2, 0.7, 0.45))
    dark = material("dark", (0.08, 0.12, 0.14))
    visor = material("visor", (0.3, 1.0, 0.9), emission=3.0)
    metal = material("metal", (0.55, 0.6, 0.66), roughness=0.3, metallic=0.8)

    box((0.5, 0.38, 0.78), (0, 0, 0.74), body, bevel=0.12)
    ball(0.26, (0, 0, 1.36), dark)
    box((0.44, 0.1, 0.12), (0, -0.2, 1.38), visor, bevel=0.03)
    tube(0.13, 0.7, (0.36, -0.36, 0.84), metal, rot=(math.pi / 2, 0, 0))   # cannon
    tube(0.09, 0.06, (0.36, -0.72, 0.84), visor, rot=(math.pi / 2, 0, 0))  # muzzle glow
    ball(0.15, (-0.36, -0.1, 0.8), dark)
    for side in (-1, 1):
        box((0.18, 0.28, 0.34), (side * 0.14, 0, 0.17), dark, bevel=0.05)
    export("shooter")


# ---- structures -------------------------------------------------------------

def portrait_frame():
    """Character portrait box. The art itself is a flat panel the game lays on
    the top and the front, so those two faces are left as plain recesses."""
    reset()
    body = material("body", (0.12, 0.13, 0.2))
    gold = material("gold", (1.0, 0.78, 0.2), roughness=0.3, metallic=0.9)

    box((0.94, 0.94, 0.96), (0, 0, 0.48), body, bevel=0.02)
    rim = 0.08
    for sx, sy, lx, ly in (
        (1.0, rim, 0, 0.5 - rim / 2), (1.0, rim, 0, -0.5 + rim / 2),
        (rim, 1.0, 0.5 - rim / 2, 0), (rim, 1.0, -0.5 + rim / 2, 0),
    ):
        box((sx, sy, rim), (lx, ly, 1.0 - rim / 2), gold, bevel=0.015)      # top rim
    for sx, sz, lx, lz in (
        (1.0, rim, 0, 1.0 - rim / 2), (1.0, rim, 0, rim / 2),
        (rim, 1.0, 0.5 - rim / 2, 0.5), (rim, 1.0, -0.5 + rim / 2, 0.5),
    ):
        box((sx, rim, sz), (lx, -0.5 + rim / 2, lz), gold, bevel=0.015)     # front rim
    export("portrait_frame")


def timer_housing():
    """Round-timer block. Digits are drawn by the game on panels over each face."""
    reset()
    body = material("body", (0.1, 0.1, 0.16))
    gold = material("gold", (1.0, 0.78, 0.2), roughness=0.3, metallic=0.9)
    bolt = material("bolt", (1.0, 0.3, 0.2), emission=2.5)

    box((0.96, 0.96, 0.94), (0, 0, 0.47), body, bevel=0.03)
    box((1.0, 1.0, 0.08), (0, 0, 0.04), gold, bevel=0.015)
    box((1.0, 1.0, 0.07), (0, 0, 0.965), gold, bevel=0.015)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ball(0.05, (sx * 0.44, sy * 0.44, 1.0), bolt)                   # warning lamps
    export("timer_housing")


def pad():
    """Floor button that fires the super. Unit radius; the game scales it."""
    reset()
    base = material("base", (0.12, 0.13, 0.2))
    ring = material("ring", (0.25, 0.75, 1.0), emission=2.0)
    cap = material("cap", (0.9, 0.95, 1.0), roughness=0.3)

    tube(1.0, 0.1, (0, 0, 0.05), base, vertices=32)
    tube(0.86, 0.06, (0, 0, 0.11), ring, vertices=32)
    tube(0.62, 0.1, (0, 0, 0.15), cap, vertices=32)
    export("pad")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for build in (fighter, grunt, shooter, portrait_frame, timer_housing, pad):
        build()
