"""
Procedural Meso-Decal generators for Blender Asset Factory.
Provides dust drifts, erosion strips, rock fields, and cracked ground.
"""

import math
import random
import bpy

def generate_dust_drift(params, seed=5203):
    rng = random.Random(seed)
    length = params.get('length', 2.8)
    width = params.get('width', 1.8)
    height = params.get('height', 0.4)

    mesh = bpy.data.meshes.new('DustDriftMesh')
    obj = bpy.data.objects.new('DustDriftObject', mesh)
    bpy.context.scene.collection.objects.link(obj)

    verts = []
    faces = []
    steps_x = 24
    steps_y = 16

    for yi in range(steps_y + 1):
        ny = (yi / steps_y - 0.5) * width
        for xi in range(steps_x + 1):
            nx = (xi / steps_x - 0.5) * length

            # Aerodynamic teardrop profile
            t_x = (nx / length + 0.5)
            x_profile = math.sin(t_x * math.pi) ** 1.5
            y_falloff = math.exp(-((ny / (width * 0.4)) ** 2) * 3.0)

            z = max(0.0, height * x_profile * y_falloff)
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

def generate_erosion_strip(params, seed=5204):
    rng = random.Random(seed)
    length = params.get('length', 3.0)
    width = params.get('width', 1.2)
    depth = params.get('depth', 0.35)

    mesh = bpy.data.meshes.new('ErosionMesh')
    obj = bpy.data.objects.new('ErosionObject', mesh)
    bpy.context.scene.collection.objects.link(obj)

    verts = []
    faces = []
    steps_x = 28
    steps_y = 12

    for yi in range(steps_y + 1):
        ny = (yi / steps_y - 0.5) * width
        for xi in range(steps_x + 1):
            nx = (xi / steps_x - 0.5) * length

            t_x = (nx / length + 0.5)
            x_falloff = math.sin(t_x * math.pi)
            gully = math.sin((ny / width + 0.5) * math.pi)
            noise = (rng.random() - 0.5) * 0.05

            z = max(0.0, depth * gully * x_falloff + noise)
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

def generate_rock_field(params, seed=5205):
    rng = random.Random(seed)
    radius = params.get('radius', 2.2)
    rock_count = params.get('count', 12)

    mesh = bpy.data.meshes.new('RockFieldMesh')
    obj = bpy.data.objects.new('RockFieldObject', mesh)
    bpy.context.scene.collection.objects.link(obj)

    verts = []
    faces = []

    for i in range(rock_count):
        # Distribute rocks within radius
        ang = rng.random() * 2.0 * math.pi
        dist = math.sqrt(rng.random()) * radius * 0.85
        cx = dist * math.cos(ang)
        cy = dist * math.sin(ang)

        r_size = 0.2 + rng.random() * 0.35
        r_height = r_size * (0.6 + rng.random() * 0.5)

        base_idx = len(verts)
        verts.append((cx, cy, r_height))
        sub_segs = 6
        for s in range(sub_segs):
            sa = (s / sub_segs) * 2.0 * math.pi
            sx = cx + (r_size + (rng.random() - 0.5) * 0.05) * math.cos(sa)
            sy = cy + (r_size + (rng.random() - 0.5) * 0.05) * math.sin(sa)
            verts.append((sx, sy, 0.0))

        for s in range(sub_segs):
            next_s = (s + 1) % sub_segs
            faces.append((base_idx, base_idx + 1 + s, base_idx + 1 + next_s))

    mesh.from_pydata(verts, [], faces)
    mesh.update()
    return obj

def generate_cracked_ground(params, seed=5206):
    rng = random.Random(seed)
    radius = params.get('radius', 2.0)
    height = params.get('height', 0.25)

    mesh = bpy.data.meshes.new('CrackedGroundMesh')
    obj = bpy.data.objects.new('CrackedGroundObject', mesh)
    bpy.context.scene.collection.objects.link(obj)

    verts = []
    faces = []
    rings = 8
    segments = 24

    verts.append((0.0, 0.0, height))

    for r in range(1, rings + 1):
        norm_r = r / rings
        cur_rad = norm_r * radius
        z = height * (1.0 - norm_r ** 1.5)

        for s in range(segments):
            angle = (s / segments) * 2.0 * math.pi
            # Fractured noise
            noise = math.sin(angle * 6.0) * 0.06 + (rng.random() - 0.5) * 0.04
            rad = max(0.1, cur_rad + noise)
            x = rad * math.cos(angle)
            y = rad * math.sin(angle)
            verts.append((x, y, max(0.0, z + noise)))

    for s in range(segments):
        next_s = (s + 1) % segments
        faces.append((0, s + 1, next_s + 1))

    for r in range(1, rings):
        ring_start = 1 + (r - 1) * segments
        next_ring_start = 1 + r * segments
        for s in range(segments):
            next_s = (s + 1) % segments
            faces.append((ring_start + s, ring_start + next_s, next_ring_start + next_s, next_ring_start + s))

    mesh.from_pydata(verts, [], faces)
    mesh.update()
    return obj
