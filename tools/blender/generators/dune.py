"""
Procedural Sand Dune generator for Blender Asset Factory.
"""

import math
import random
import bpy

def generate_dune(params, seed=401):
    rng = random.Random(seed)
    wavelength = params.get('wavelength', 1.6)
    crest_height = params.get('crestHeight', 0.8)
    asymmetry = params.get('asymmetry', 0.6)

    mesh = bpy.data.meshes.new('DuneMesh')
    obj = bpy.data.objects.new('DuneObject', mesh)
    bpy.context.scene.collection.objects.link(obj)

    verts = []
    faces = []

    steps_x = 24
    steps_y = 16

    for yi in range(steps_y + 1):
        ny = (yi / steps_y - 0.5) * 2.0
        for xi in range(steps_x + 1):
            nx = (xi / steps_x - 0.5) * 2.5

            # Asymmetric dune wave profile (gentle windward, steep slipface)
            phase = (ny / wavelength) * math.pi
            wave = math.sin(phase) if phase >= 0 else math.sin(phase * (1.0 / max(0.1, 1.0 - asymmetry)))
            dune_curve = max(0.0, wave * crest_height * math.cos(nx * 0.7))
            noise = (rng.random() - 0.5) * 0.05

            verts.append((nx, ny, max(0.0, dune_curve + noise)))

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
