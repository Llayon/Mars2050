"""
Headless entrypoint for Mars2050 Blender Asset Factory.
Reads authoritative map-render-profile.json and map-asset-factory.json.
Renders Albedo, View-Space Normal, and Packed Data maps into staging directory.
"""

import sys
import os
import json
import argparse

# Add current directory to path for local imports
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.append(script_dir)

try:
    import bpy
    from scene_setup import setup_render_engine, setup_camera, setup_lighting
    from materials import (
        create_regolith_material,
        create_basalt_material,
        create_dust_material,
        create_rock_material,
        create_view_space_normal_material,
        create_data_pass_material
    )
    from generators.crater import generate_crater
    from generators.ridge import generate_ridge
    from generators.rocks import generate_rocks
    from generators.dune import generate_dune
    from generators.mesa import generate_mesa
    from generators.ridge_chain import generate_ridge_chain
    from generators.meso_decal import (
        generate_dust_drift,
        generate_erosion_strip,
        generate_rock_field,
        generate_cracked_ground
    )
except ImportError:
    # Allows module inspection outside Blender environment
    bpy = None

def parse_args():
    # Blender passes arguments after '--'
    args = sys.argv
    if '--' in args:
        args = args[args.index('--') + 1:]
    else:
        args = []

    parser = argparse.ArgumentParser(description='Mars2050 Blender Asset Factory')
    parser.add_argument('--output-dir', required=True, help='Output staging directory for raw renders')
    parser.add_argument('--config', default='assets/pipeline/map-asset-factory.json', help='Path to factory config')
    parser.add_argument('--profile', default='assets/pipeline/map-render-profile.json', help='Path to render profile')
    return parser.parse_args(args)

def clear_mesh_objects():
    scene = bpy.context.scene
    for obj in list(scene.objects):
        if obj.type not in ['CAMERA', 'LIGHT']:
            bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh, do_unlink=True)

def assign_material_recursive(obj, mat):
    if obj.type == 'MESH':
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
    for child in obj.children:
        assign_material_recursive(child, mat)

def get_max_z(obj):
    max_z = 0.5
    if obj.type == 'MESH' and obj.data.vertices:
        for v in obj.data.vertices:
            if v.co.z > max_z:
                max_z = v.co.z
    for child in obj.children:
        cz = get_max_z(child)
        if cz > max_z:
            max_z = cz
    return max_z

def set_color_management(scene, view_transform='Standard'):
    if not hasattr(scene, 'view_settings'):
        return
    settings = scene.view_settings
    settings.view_transform = view_transform
    settings.exposure = 0.0
    settings.gamma = 1.0
    try:
        settings.look = 'None'
    except (TypeError, ValueError, AttributeError):
        pass
    if view_transform == 'Raw':
        assert scene.view_settings.view_transform == 'Raw', "Failed to set Raw view transform for linear pass"

def run_factory():
    if not bpy:
        print("Error: bpy (Blender Python API) is not available. Run inside Blender via --python.")
        sys.exit(1)

    args = parse_args()
    os.makedirs(args.output_dir, exist_ok=True)

    with open(args.profile, 'r', encoding='utf-8') as f:
        profile = json.load(f)

    with open(args.config, 'r', encoding='utf-8') as f:
        factory_config = json.load(f)

    render_settings = factory_config.get('renderSettings', {})
    setup_render_engine(
        resolution=render_settings.get('resolution', 512),
        samples=render_settings.get('samples', 64),
        transparent=render_settings.get('transparentBackground', True)
    )
    setup_camera(profile)
    setup_lighting(profile)

    manifest_assets = []
    total_assets = len(factory_config.get('assets', []))
    print(f"Starting Blender factory render for {total_assets} assets...")

    for idx, asset_def in enumerate(factory_config.get('assets', [])):
        asset_id = asset_def['id']
        generator_kind = asset_def['generator']
        seed = asset_def.get('seed', 101)
        params = asset_def.get('params', {})

        print(f"[{idx + 1}/{total_assets}] Generating asset [{asset_id}] (kind: {generator_kind}, seed: {seed})...")
        clear_mesh_objects()

        # Build mesh
        if generator_kind == 'crater':
            obj = generate_crater(params, seed)
            albedo_mat = create_regolith_material()
        elif generator_kind == 'mesa':
            obj = generate_mesa(params, seed)
            albedo_mat = create_regolith_material()
        elif generator_kind == 'ridge_chain':
            obj = generate_ridge_chain(params, seed)
            albedo_mat = create_rock_material()
        elif generator_kind == 'dust_drift':
            obj = generate_dust_drift(params, seed)
            albedo_mat = create_dust_material()
        elif generator_kind == 'erosion_strip':
            obj = generate_erosion_strip(params, seed)
            albedo_mat = create_regolith_material()
        elif generator_kind == 'rock_field':
            obj = generate_rock_field(params, seed)
            albedo_mat = create_rock_material()
        elif generator_kind == 'cracked_ground':
            obj = generate_cracked_ground(params, seed)
            albedo_mat = create_regolith_material()
        elif generator_kind == 'ridge':
            obj = generate_ridge(params, seed)
            albedo_mat = create_regolith_material()
        elif generator_kind == 'rocks':
            obj = generate_rocks(params, seed)
            albedo_mat = create_rock_material()
        elif generator_kind == 'dune':
            obj = generate_dune(params, seed)
            albedo_mat = create_dust_material()
        elif generator_kind == 'basalt':
            obj = generate_rocks(params, seed)
            albedo_mat = create_basalt_material()
        elif generator_kind == 'dust':
            obj = generate_dune(params, seed)
            albedo_mat = create_dust_material()
        else:
            obj = generate_rocks(params, seed)
            albedo_mat = create_regolith_material()

        max_height = get_max_z(obj)
        normal_mat = create_view_space_normal_material()
        data_mat = create_data_pass_material(max_height=max_height)

        # Output filenames
        albedo_filename = f"{asset_id}.albedo.png"
        normal_filename = f"{asset_id}.normal.png"
        data_filename = f"{asset_id}.data.png"

        albedo_path = os.path.join(args.output_dir, albedo_filename)
        normal_path = os.path.join(args.output_dir, normal_filename)
        data_path = os.path.join(args.output_dir, data_filename)

        # 1. Albedo Pass (Standard Display/Render Transform)
        set_color_management(bpy.context.scene, 'Standard')
        assign_material_recursive(obj, albedo_mat)
        bpy.context.scene.render.filepath = albedo_path
        bpy.ops.render.render(write_still=True)

        # 2. View-Space Normal Pass (Raw / Non-Color Linear)
        set_color_management(bpy.context.scene, 'Raw')
        assign_material_recursive(obj, normal_mat)
        bpy.context.scene.render.filepath = normal_path
        bpy.ops.render.render(write_still=True)

        # 3. Packed Data Pass (Raw / Non-Color Linear)
        set_color_management(bpy.context.scene, 'Raw')
        assign_material_recursive(obj, data_mat)
        bpy.context.scene.render.filepath = data_path
        bpy.ops.render.render(write_still=True)

        manifest_assets.append({
            "id": asset_id,
            "layer": asset_def.get("layer", "macro"),
            "source": {
                "albedo": albedo_filename,
                "normal": normal_filename,
                "data": data_filename
            },
            "anchorPx": asset_def.get("anchorPx", { "x": 256, "y": 256 }),
            "footprint": asset_def.get("footprint", [{ "x": 0, "y": 0 }])
        })

    # Write raw_manifest.json to staging directory
    raw_manifest = {
        "version": 2,
        "assets": manifest_assets
    }
    with open(os.path.join(args.output_dir, 'raw_manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(raw_manifest, f, indent=2)

    print(f"Factory execution complete. Generated {len(manifest_assets)} multi-channel assets in {args.output_dir}")

if __name__ == '__main__':
    run_factory()
