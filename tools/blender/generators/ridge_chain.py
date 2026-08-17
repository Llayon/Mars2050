"""
Procedural Ridge Chain generator for Blender Asset Factory.
Generates elongated multi-peak rocky mountain spine.
"""

import math
import random
import bpy

def generate_ridge_chain(params, seed=5202):
    rng = random.Random(seed)
    length = params.get('length', 3.4)
    width = params.get('width', 1.6)
    height = params.get('height', 1.5)
    segments_count = params.get('segments', 3)

    mesh = bpy.data.meshes.new('RidgeChainMesh')
    obj = bpy.data.objects.new('RidgeChainObject', mesh)
    bpy.context.scene.collection.objects.link(obj)

    verts = []
    faces = []

    steps_x = 36
    steps_y = 16

    for yi in range(steps_y + 1):
        ny = (yi / steps_y - 0.5) * width
        for xi in range(steps_x + 1):
            nx = (xi / steps_x - 0.5) * length

            # Multi-peak wave along X spine
            spine_phase = (nx / length + 0.5) * math.pi * segments_count
            spine_mod = 0.7 + 0.3 * math.sin(spine_phase)

            # Lateral Gaussian profile
            falloff = math.exp(-((ny / (width * 0.35)) ** 2) * 3.5)

            # High frequency jagged noise
            noise = (rng.random() - 0.5) * 0.12 * falloff
            z = max(0.0, height * spine_mod * falloff + noise)

            verts.append((nx, ny, z))

    for yi in range(steps_y):
        for xi in range(steps_x):
            v1 = yi * (steps_x + 1) + xi
            v2 = v1 + 1
            v3 = (yi + 1) * (steps_x + 1) + xi + 1
            v4 = (yi + 1) * (steps_x + 1) + xi
            faces.append((v1, v2, v3, v4))

    mesh.from_pydata(verts, [], faces)
    mesh.update()
    return obj
