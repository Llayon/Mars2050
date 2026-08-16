"""
Procedural Rocks and Boulders cluster generator for Blender Asset Factory.
"""

import math
import random
import bpy

def generate_rocks(params, seed=301):
    rng = random.Random(seed)
    count = params.get('count', 5)
    max_size = params.get('maxSize', 0.4)
    dispersion = params.get('dispersion', 0.8)

    # Master parent container
    parent_obj = bpy.data.objects.new('RocksCluster', None)
    bpy.context.scene.collection.objects.link(parent_obj)

    for i in range(count):
        size = max_size * (0.4 + rng.random() * 0.6)
        angle = rng.random() * 2.0 * math.pi
        dist = rng.random() * dispersion

        x = dist * math.cos(angle)
        y = dist * math.sin(angle)
        z = size * 0.4

        # Create deformed icosphere for rock
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=size, location=(x, y, z))
        rock_obj = bpy.context.active_object
        rock_obj.parent = parent_obj
        rock_obj.scale = (
            1.0 + (rng.random() - 0.5) * 0.4,
            1.0 + (rng.random() - 0.5) * 0.4,
            0.6 + rng.random() * 0.4
        )
        rock_obj.rotation_euler = (
            rng.random() * math.pi,
            rng.random() * math.pi,
            rng.random() * math.pi
        )

    return parent_obj
