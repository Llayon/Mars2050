"""
Scene setup module for Mars2050 Blender Asset Factory.
Reads camera, lighting, and scale parameters from map-render-profile.json.
Configures view-space Normal pass and asset-local Height Data pass.
"""

import math
import bpy

def setup_render_engine(resolution=512, samples=64, transparent=True):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    
    if hasattr(scene, 'cycles'):
        scene.cycles.samples = samples
        scene.cycles.use_denoising = True

def setup_camera(profile):
    """
    Configures fixed orthographic camera matching 2.5D render profile.
    cameraPitch (e.g. 60 deg) and cameraYaw (e.g. 0 deg).
    """
    scene = bpy.context.scene
    
    # Remove existing cameras
    for obj in list(scene.objects):
        if obj.type == 'CAMERA':
            bpy.data.objects.remove(obj, do_unlink=True)
            
    cam_data = bpy.data.cameras.new(name='OrthoCamera')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = profile.get('orthoScale', 4.0)
    
    cam_obj = bpy.data.objects.new(name='OrthoCamera', object_data=cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    
    pitch_rad = math.radians(profile.get('cameraPitch', 60.0))
    yaw_rad = math.radians(profile.get('cameraYaw', 0.0))
    
    # Distance from origin
    dist = 20.0
    cam_obj.location = (
        dist * math.sin(yaw_rad) * math.cos(pitch_rad),
        -dist * math.cos(yaw_rad) * math.cos(pitch_rad),
        dist * math.sin(pitch_rad)
    )
    cam_obj.rotation_euler = (
        math.radians(90.0) - pitch_rad,
        0.0,
        yaw_rad
    )
    return cam_obj

def setup_lighting(profile):
    """
    Configures directional sun lighting matching azimuth and elevation.
    """
    scene = bpy.context.scene
    
    # Remove existing lights
    for obj in list(scene.objects):
        if obj.type == 'LIGHT':
            bpy.data.objects.remove(obj, do_unlink=True)
            
    light_data = bpy.data.lights.new(name='MarsSun', type='SUN')
    light_data.energy = 3.5
    light_data.color = (1.0, 0.92, 0.85) # Warm Martian sunlight
    
    light_obj = bpy.data.objects.new(name='MarsSun', object_data=light_data)
    scene.collection.objects.link(light_obj)
    
    azimuth_rad = math.radians(profile.get('sunAzimuth', 135.0))
    elevation_rad = math.radians(profile.get('sunElevation', 45.0))
    
    light_obj.rotation_euler = (
        math.radians(90.0) - elevation_rad,
        0.0,
        azimuth_rad
    )
    return light_obj

def setup_compositor_nodes(output_prefix, staging_dir):
    """
    Sets up Blender Compositor passes:
    - Albedo (RGBA)
    - Normal (Camera/View-Space normalized [0..1] -> [0..255])
    - Data (R=Height, G=AO, B=Emissive, A=Mask)
    """
    scene = bpy.context.scene
    scene.use_nodes = True
    scene.view_layers[0].use_pass_normal = True
    scene.view_layers[0].use_pass_ambient_occlusion = True
    scene.view_layers[0].use_pass_emit = True
    scene.view_layers[0].use_pass_z = True

    tree = scene.node_tree
    for node in list(tree.nodes):
        tree.nodes.remove(node)

    render_layers = tree.nodes.new(type='CompositorNodeRLayers')
    render_layers.location = (0, 0)

    # Main Albedo Composite output
    composite = tree.nodes.new(type='CompositorNodeComposite')
    composite.location = (400, 200)
    tree.links.new(render_layers.outputs['Image'], composite.inputs['Image'])
