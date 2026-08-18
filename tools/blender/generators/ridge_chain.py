"""
Procedural Ridge Chain generator for Blender Asset Factory.
Generates elongated multi-peak rocky mountain spines with secondary shoulders.
"""

import math
import random
import bpy

def generate_ridge_chain(params, seed=5202):
    rng = random.Random(seed)
    length = params.get('length', 4.4)
    width = params.get('width', 2.0)
    height = params.get('height', 1.8)
    segments_count = params.get('segments', 4)

    mesh = bpy.data.meshes.new('RidgeChainMesh')
    obj = bpy.data.objects.new('RidgeChainObject', mesh)
    bpy.context.scene.collection.objects.link(obj)

    verts = []
    faces = []

    steps_x = 42
    steps_y = 20

    for yi in range(steps_y + 1):
        ny_norm = yi / steps_y
        ny = (ny_norm - 0.5) * width
        for xi in range(steps_x + 1):
            nx_norm = xi / steps_x
            nx = (nx_norm - 0.5) * length

            # Multi-peak wave along X spine with secondary harmonics
            spine_phase = nx_norm * math.pi * segments_count
            spine_mod = 0.65 + 0.35 * math.sin(spine_phase) + 0.15 * math.cos(spine_phase * 2.0)

            # Asymmetric lateral profile: steeper on south/leeward side
            flank_steepness = 3.8 if ny > 0 else 2.8
            falloff = math.exp(-((ny / (width * 0.38)) ** 2) * flank_steepness)

            # High-frequency jagged crest noise
            crest_proximity = falloff ** 2
            crest_noise = (rng.random() - 0.5) * 0.18 * crest_proximity

            # Longitudinal end taper
            end_taper = math.sin(nx_norm * math.pi) ** 0.55

            z = max(0.0, height * spine_mod * falloff * end_taper + crest_noise)
            verts.append((nx, ny, z))

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
