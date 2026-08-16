"""
Procedural Ridge / Cliff generator for Blender Asset Factory.
"""

import math
import random
import bpy

def generate_ridge(params, seed=201):
    rng = random.Random(seed)
    length = params.get('length', 2.5)
    height = params.get('height', 1.2)
    steepness = params.get('steepness', 0.8)

    mesh = bpy.data.meshes.new('RidgeMesh')
    obj = bpy.data.objects.new('RidgeObject', mesh)
    bpy.context.scene.collection.objects.link(obj)

    verts = []
    faces = []

    steps_x = 24
    steps_y = 12

    for yi in range(steps_y + 1):
        ny = (yi / steps_y - 0.5) * 1.8
        for xi in range(steps_x + 1):
            nx = (xi / steps_x - 0.5) * length

            # Ridge crest along x-axis, steep falloff on y
            crest_factor = math.exp(-((ny / max(0.1, 1.0 - steepness * 0.5)) ** 2) * 4.0)
            noise = (rng.random() - 0.5) * 0.15
            z = max(0.0, (height * crest_factor * math.cos(nx * 0.8 / length)) + noise)

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
