"""
Procedural Basalt Outcrop generator for Blender Asset Factory.
Generates clusters of dark, polygonal columnar basalt pillars with distinct flat tops and sheer vertical sides.
"""

import math
import random
import bpy

def generate_basalt_outcrop(params, seed=5303):
    rng = random.Random(seed)
    radius = params.get('radius', 2.4)
    max_height = params.get('height', 2.2)
    column_count = params.get('columns', 16)

    mesh = bpy.data.meshes.new('BasaltOutcropMesh')
    obj = bpy.data.objects.new('BasaltOutcropObject', mesh)
    bpy.context.scene.collection.objects.link(obj)

    verts = []
    faces = []

    for c in range(column_count):
        ang = rng.random() * 2.0 * math.pi
        dist = math.sqrt(rng.random()) * radius * 0.80
        cx = dist * math.cos(ang)
        cy = dist * math.sin(ang)

        height_factor = max(0.35, 1.0 - (dist / radius) * 0.65)
        h = max_height * height_factor * (0.85 + rng.random() * 0.35)
        col_rad = 0.35 + rng.random() * 0.30

        sides = 6
        base_v = len(verts)

        # Top center vertex
        verts.append((cx, cy, h))

        # Top perimeter vertices (counter-clockwise looking from above)
        for s in range(sides):
            sa = (s / sides) * 2.0 * math.pi
            px = cx + col_rad * math.cos(sa)
            py = cy + col_rad * math.sin(sa)
            verts.append((px, py, h))

        # Bottom perimeter vertices
        for s in range(sides):
            sa = (s / sides) * 2.0 * math.pi
            px = cx + (col_rad * 1.08) * math.cos(sa)
            py = cy + (col_rad * 1.08) * math.sin(sa)
            verts.append((px, py, 0.0))

        # Top cap faces (outward normal pointing UP +Z)
        for s in range(sides):
            next_s = (s + 1) % sides
            faces.append((base_v, base_v + 1 + s, base_v + 1 + next_s))

        # Side column quad faces (outward normal pointing radially away from center)
        for s in range(sides):
            next_s = (s + 1) % sides
            v_top1 = base_v + 1 + s
            v_top2 = base_v + 1 + next_s
            v_bot1 = base_v + 1 + sides + s
            v_bot2 = base_v + 1 + sides + next_s
            faces.append((v_top1, v_bot1, v_bot2, v_top2))

    mesh.from_pydata(verts, [], faces)
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.update()
    return obj
