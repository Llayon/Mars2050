"""
Procedural Cliff Chain generator for Blender Asset Factory.
Generates multi-tiered stepped rocky cliff formations with basalt fractures.
"""

import math
import random
import bpy

def generate_cliff_chain(params, seed=5302):
    rng = random.Random(seed)
    length = params.get('length', 3.8)
    width = params.get('width', 2.0)
    height = params.get('height', 1.9)
    tiers = params.get('tiers', 3)

    mesh = bpy.data.meshes.new('CliffChainMesh')
    obj = bpy.data.objects.new('CliffChainObject', mesh)
    bpy.context.scene.collection.objects.link(obj)

    verts = []
    faces = []

    steps_x = 32
    steps_y = 18

    for yi in range(steps_y + 1):
        ny_norm = yi / steps_y
        ny = (ny_norm - 0.5) * width

        for xi in range(steps_x + 1):
            nx_norm = xi / steps_x
            nx = (nx_norm - 0.5) * length

            # Stepped tier profile: staircase terraces with jagged vertical risers
            tier_val = (1.0 - ny_norm) * tiers
            tier_idx = math.floor(tier_val)
            tier_frac = tier_val - tier_idx

            # Terrace shelf: mostly flat with sharp riser drop
            if tier_frac < 0.65:
                # Flat terrace surface
                z_tier = (tier_idx + 0.65) / tiers
            else:
                # Stepped cliff drop
                t = (tier_frac - 0.65) / 0.35
                z_tier = (tier_idx + 0.65 * math.cos(t * math.pi * 0.5)) / tiers

            # Spine variation along X
            spine_mod = 0.8 + 0.2 * math.sin(nx_norm * math.pi * 2.0 + rng.random() * 0.5)
            end_taper = math.sin(nx_norm * math.pi) ** 0.6

            # High-frequency rock fracture noise
            noise = (rng.random() - 0.5) * 0.08

            final_z = max(0.0, height * z_tier * spine_mod * end_taper + noise)
            verts.append((nx, ny, final_z))

    for yi in range(steps_y):
        for xi in range(steps_x):
            v1 = yi * (steps_x + 1) + xi
            v2 = v1 + 1
            v3 = (yi + 1) * (steps_x + 1) + xi + 1
            v4 = (yi + 1) * (steps_x + 1) + xi
            faces.append((v1, v2, v3, v4))

    mesh.from_pydata(verts, [], faces)
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.update()
    return obj
