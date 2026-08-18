"""
Procedural Mesa / Plateau generator for Blender Asset Factory.
Generates flat-topped table mountain with sharp cliff walls, stepped ledges, and talus skirt.
"""

import math
import random
import bpy

def generate_mesa(params, seed=5201):
    rng = random.Random(seed)
    radius_top = params.get('radiusTop', 1.8)
    radius_base = params.get('radiusBase', 2.8)
    height = params.get('height', 2.2)
    steepness = params.get('steepness', 0.90)

    mesh = bpy.data.meshes.new('MesaMesh')
    obj = bpy.data.objects.new('MesaObject', mesh)
    bpy.context.scene.collection.objects.link(obj)

    verts = []
    faces = []

    rings = 18
    segments = 36

    # Generate asymmetric polygon distortion vectors for top and base
    top_poly_radii = [1.0 + (rng.random() - 0.5) * 0.35 for _ in range(segments)]
    base_poly_radii = [1.0 + (rng.random() - 0.5) * 0.40 for _ in range(segments)]

    # Top center vertex
    top_center_noise = (rng.random() - 0.5) * 0.04
    verts.append((0.0, 0.0, height + top_center_noise))

    for r in range(1, rings + 1):
        norm_r = r / rings

        # Profile:
        # norm_r 0.0 .. 0.45: Flat top plateau with micro-erosion
        # norm_r 0.45 .. 0.75: Sheer vertical cliff wall with stepped ledge
        # norm_r 0.75 .. 1.0: Talus / rubble skirt tapering to 0
        if norm_r < 0.45:
            t = norm_r / 0.45
            cur_rad_factor = t
            cur_base_rad = radius_top
            z = height + ((rng.random() - 0.5) * 0.04)
        elif norm_r < 0.75:
            t = (norm_r - 0.45) / 0.30
            cur_base_rad = radius_top + t * (radius_base * 0.75 - radius_top)
            cur_rad_factor = 1.0
            # Stepped cosine cliff with middle ledge notch
            cliff_factor = math.cos(t * math.pi * 0.5) ** (1.0 / steepness)
            ledge_bump = math.sin(t * math.pi * 3.0) * 0.07 if (0.3 < t < 0.7) else 0.0
            z = height * cliff_factor + ledge_bump
        else:
            t = (norm_r - 0.75) / 0.25
            cur_base_rad = (radius_base * 0.75) + t * (radius_base * 0.25)
            cur_rad_factor = 1.0
            # Talus apron meeting zero smoothly
            z = (height * 0.15) * math.cos(t * math.pi * 0.5)

        for s in range(segments):
            angle = (s / segments) * 2.0 * math.pi
            poly_t = top_poly_radii[s] if norm_r < 0.45 else (
                top_poly_radii[s] * (1.0 - (norm_r - 0.45) / 0.55) +
                base_poly_radii[s] * ((norm_r - 0.45) / 0.55)
            )
            rad = max(0.1, cur_base_rad * cur_rad_factor * poly_t)
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
