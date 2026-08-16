"""
Procedural Crater generator for Blender Asset Factory.
"""

import math
import random
import bpy

def generate_crater(params, seed=101):
    rng = random.Random(seed)
    radius = params.get('radius', 1.4)
    depth = params.get('depth', 0.6)
    rim_height = params.get('rimHeight', 0.35)
    has_peak = params.get('centralPeak', False)

    mesh = bpy.data.meshes.new('CraterMesh')
    obj = bpy.data.objects.new('CraterObject', mesh)
    bpy.context.scene.collection.objects.link(obj)

    verts = []
    faces = []

    rings = 16
    segments = 32

    # Central vertex
    center_z = 0.2 if has_peak else -depth
    verts.append((0.0, 0.0, center_z))

    for r in range(1, rings + 1):
        norm_r = r / rings
        cur_rad = norm_r * radius * 1.5

        # Profile curve: rim at norm_r ~ 0.6, floor inside
        if norm_r < 0.6:
            norm_floor = norm_r / 0.6
            z = -depth * (1.0 - norm_floor) + (0.3 * (1.0 - norm_floor) if has_peak else 0.0)
        elif norm_r < 0.8:
            norm_rim = (norm_r - 0.6) / 0.2
            z = rim_height * math.sin(norm_rim * math.pi)
        else:
            norm_outer = (norm_r - 0.8) / 0.2
            z = rim_height * (1.0 - norm_outer) * 0.5

        # Asymmetric noise
        for s in range(segments):
            angle = (s / segments) * 2.0 * math.pi
            noise = (rng.random() - 0.5) * 0.08
            x = (cur_rad + noise) * math.cos(angle)
            y = (cur_rad + noise) * math.sin(angle)
            verts.append((x, y, max(0.0, z + noise)))

    for s in range(segments):
        next_s = (s + 1) % segments
        faces.append((0, s + 1, next_s + 1))

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
    mesh.update()
    return obj
