"""
Procedural Escarpment / Cliff Wall generator for Blender Asset Factory.
Generates an authoritative vertical cliff face with upper plateau and talus debris skirt.
"""

import math
import random
import bpy

def generate_escarpment(params, seed=5301):
    rng = random.Random(seed)
    length = params.get('length', 4.2)
    width = params.get('width', 2.4)
    height = params.get('height', 2.2)
    cliff_steepness = params.get('cliffSteepness', 0.92)

    mesh = bpy.data.meshes.new('EscarpmentMesh')
    obj = bpy.data.objects.new('EscarpmentObject', mesh)
    bpy.context.scene.collection.objects.link(obj)

    verts = []
    faces = []

    steps_x = 36
    steps_y = 20

    for yi in range(steps_y + 1):
        ny_norm = yi / steps_y # 0.0 (top plateau) to 1.0 (lower base)
        ny = (ny_norm - 0.5) * width

        for xi in range(steps_x + 1):
            nx_norm = xi / steps_x
            nx = (nx_norm - 0.5) * length

            # Curvature along the cliff ridge line
            ridge_curve = math.sin(nx_norm * math.pi) * 0.35 * width

            # Y-profile:
            # 0.0 .. 0.35: Upper flat plateau
            # 0.35 .. 0.65: Sheer vertical/sub-vertical cliff drop with stepped ledges
            # 0.65 .. 1.0: Talus / debris apron sloping to ground
            if ny_norm < 0.35:
                # Upper plateau with subtle undulation
                z = height + (rng.random() - 0.5) * 0.06
            elif ny_norm < 0.65:
                t = (ny_norm - 0.35) / 0.30
                # Stepped ledge profile using quantized cosine
                cliff_t = math.cos(t * math.pi * 0.5) ** (1.0 / cliff_steepness)
                ledge_noise = math.sin(t * math.pi * 4.0 + rng.random()) * 0.08
                z = height * cliff_t + ledge_noise
            else:
                t = (ny_norm - 0.65) / 0.35
                # Talus apron meeting base smoothly
                z = (height * 0.18) * math.cos(t * math.pi * 0.5)

            # Jagged horizontal noise along cliff face
            cliff_mask = 1.0 if (0.3 < ny_norm < 0.7) else 0.2
            noise_x = (rng.random() - 0.5) * 0.12 * cliff_mask
            noise_y = (rng.random() - 0.5) * 0.15 * cliff_mask

            # Longitudinal taper at ends so the escarpment fades into ground at extremes
            end_taper = math.sin(nx_norm * math.pi) ** 0.5
            final_z = max(0.0, z * end_taper)

            verts.append((nx + noise_x, ny + ridge_curve + noise_y, final_z))

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
