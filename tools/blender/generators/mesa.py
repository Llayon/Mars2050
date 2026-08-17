"""
Procedural Mesa / Plateau generator for Blender Asset Factory.
Generates flat-topped table mountain with cliff walls and talus skirt.
"""

import math
import random
import bpy

def generate_mesa(params, seed=5201):
    rng = random.Random(seed)
    radius_top = params.get('radiusTop', 1.2)
    radius_base = params.get('radiusBase', 2.0)
    height = params.get('height', 1.8)
    steepness = params.get('steepness', 0.85)

    mesh = bpy.data.meshes.new('MesaMesh')
    obj = bpy.data.objects.new('MesaObject', mesh)
    bpy.context.scene.collection.objects.link(obj)

    verts = []
    faces = []

    rings = 14
    segments = 32

    # Top center vertex
    top_center_noise = (rng.random() - 0.5) * 0.05
    verts.append((0.0, 0.0, height + top_center_noise))

    for r in range(1, rings + 1):
        norm_r = r / rings

        # Plateau profile:
        # norm_r 0.0 .. 0.5: flat top with micro-undulation
        # norm_r 0.5 .. 0.8: steep cliff wall falloff
        # norm_r 0.8 .. 1.0: talus / scree skirt tapering into ground
        if norm_r < 0.5:
            cur_rad = (norm_r / 0.5) * radius_top
            z = height + ((rng.random() - 0.5) * 0.06)
        elif norm_r < 0.8:
            t = (norm_r - 0.5) / 0.3
            cur_rad = radius_top + t * (radius_base * 0.7 - radius_top)
            # Smooth cosine cliff wall falloff
            cliff_factor = math.cos(t * math.pi * 0.5)
            z = height * cliff_factor
        else:
            t = (norm_r - 0.8) / 0.2
            cur_rad = (radius_base * 0.7) + t * (radius_base * 0.3)
            # Talus apron softly meeting zero
            z = (height * 0.15) * math.cos(t * math.pi * 0.5)

        for s in range(segments):
            angle = (s / segments) * 2.0 * math.pi
            # Asymmetric angular warping
            warp = math.sin(angle * 3.0 + rng.random()) * 0.10 * cur_rad
            rad = max(0.1, cur_rad + warp)
            x = rad * math.cos(angle)
            y = rad * math.sin(angle)
            verts.append((x, y, max(0.0, z)))

    # Connect top center fan
    for s in range(segments):
        next_s = (s + 1) % segments
        faces.append((0, s + 1, next_s + 1))

    # Connect rings
    for r in range(1, rings):
        ring_start = 1 + (r - 1) * segments
        next_ring_start = 1 + r * segments
        for s in range(segments):
            next_s = (s + 1) % segments
            v1 = ring_start + s
            v2 = ring_start + next_s
            v3 = next_ring_start + next_s
            v4 = next_ring_start + s
            faces.append((v1, v2, v3, v4))

    mesh.from_pydata(verts, [], faces)
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.update()
    return obj
