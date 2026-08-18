"""
Procedural material library for Mars2050 terrain rendering in Blender.
Provides specialized Martian shaders: Regolith, Basalt, Dust, Rock,
as well as Camera/View-Space Normal and Asset-Local Height Data pass materials.
"""

import bpy

def create_regolith_material(name='Mat_Regolith', roughness=0.45):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (0.65, 0.28, 0.15, 1.0) # Mars Iron Oxide Red
        bsdf.inputs['Roughness'].default_value = roughness
    return mat

def create_basalt_material(name='Mat_Basalt', darkness=0.8):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get('Principled BSDF')
    if bsdf:
        val = max(0.05, 0.25 * (1.0 - darkness))
        bsdf.inputs['Base Color'].default_value = (val * 1.2, val * 0.9, val * 0.8, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.85
    return mat

def create_dust_material(name='Mat_Dust', brightness=0.7):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get('Principled BSDF')
    if bsdf:
        b = 0.5 + brightness * 0.3
        bsdf.inputs['Base Color'].default_value = (b, b * 0.55, b * 0.25, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.95
    return mat

def create_rock_material(name='Mat_Rock'):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (0.45, 0.32, 0.25, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.75
    return mat

def create_mesa_material(name='Mat_Mesa'):
    """
    Slope-dependent material:
    Top flat plateaus are bright iron-oxide regolith.
    Steep cliff walls are darker weathered basalt rock.
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.clear()

    geom = tree.nodes.new('ShaderNodeNewGeometry')
    geom.location = (-400, 0)

    sep_norm = tree.nodes.new('ShaderNodeSeparateXYZ')
    sep_norm.location = (-200, 0)
    tree.links.new(geom.outputs['Normal'], sep_norm.inputs['Vector'])

    # Color ramp / mix based on upward Normal Z
    mix_rgb = tree.nodes.new('ShaderNodeMix')
    mix_rgb.data_type = 'RGBA'
    mix_rgb.location = (0, 0)
    # Factor based on Z normal: steep sides (<0.6) = A, flat top (>0.75) = B
    map_range = tree.nodes.new('ShaderNodeMapRange')
    map_range.location = (-100, 150)
    map_range.inputs['From Min'].default_value = 0.35
    map_range.inputs['From Max'].default_value = 0.75
    tree.links.new(sep_norm.outputs['Z'], map_range.inputs['Value'])
    tree.links.new(map_range.outputs['Result'], mix_rgb.inputs['Factor'])

    # Color A: Dark cliff rock
    mix_rgb.inputs[6].default_value = (0.35, 0.22, 0.16, 1.0)
    # Color B: Bright plateau regolith
    mix_rgb.inputs[7].default_value = (0.68, 0.30, 0.16, 1.0)

    bsdf = tree.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (200, 0)
    bsdf.inputs['Roughness'].default_value = 0.85
    tree.links.new(mix_rgb.outputs[2], bsdf.inputs['Base Color'])

    out = tree.nodes.new('ShaderNodeOutputMaterial')
    out.location = (450, 0)
    tree.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    return mat

def create_cliff_material(name='Mat_Cliff'):
    """
    Dark fractured rock material for sheer escarpments and basalt formations.
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.clear()

    geom = tree.nodes.new('ShaderNodeNewGeometry')
    geom.location = (-400, 0)

    sep_norm = tree.nodes.new('ShaderNodeSeparateXYZ')
    sep_norm.location = (-200, 0)
    tree.links.new(geom.outputs['Normal'], sep_norm.inputs['Vector'])

    map_range = tree.nodes.new('ShaderNodeMapRange')
    map_range.location = (-100, 150)
    map_range.inputs['From Min'].default_value = 0.25
    map_range.inputs['From Max'].default_value = 0.80
    tree.links.new(sep_norm.outputs['Z'], map_range.inputs['Value'])

    mix_rgb = tree.nodes.new('ShaderNodeMix')
    mix_rgb.data_type = 'RGBA'
    mix_rgb.location = (0, 0)
    tree.links.new(map_range.outputs['Result'], mix_rgb.inputs['Factor'])

    # Dark basalt cliff face
    mix_rgb.inputs[6].default_value = (0.28, 0.18, 0.14, 1.0)
    # Dust cap on flat shelf
    mix_rgb.inputs[7].default_value = (0.58, 0.28, 0.18, 1.0)

    bsdf = tree.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (200, 0)
    bsdf.inputs['Roughness'].default_value = 0.80
    tree.links.new(mix_rgb.outputs[2], bsdf.inputs['Base Color'])

    out = tree.nodes.new('ShaderNodeOutputMaterial')
    out.location = (450, 0)
    tree.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    return mat

def create_view_space_normal_material(name='Mat_ViewSpaceNormal'):
    """
    Renders camera/view-space normal vectors:
    R: +X (screen right), G: +Y (screen up), B: +Z (toward camera).
    Mapped from [-1..1] to [0..1] (neutral 128, 128, 255).
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.clear()

    geom = tree.nodes.new('ShaderNodeNewGeometry')
    geom.location = (-400, 0)

    # Convert World Normal to Camera/View space
    vec_trans = tree.nodes.new('ShaderNodeVectorTransform')
    vec_trans.vector_type = 'VECTOR'
    vec_trans.convert_from = 'WORLD'
    vec_trans.convert_to = 'CAMERA'
    vec_trans.location = (-300, 0)
    tree.links.new(geom.outputs['Normal'], vec_trans.inputs['Vector'])

    # Invert Z component: Blender camera looks along -Z, while runtime contract expects +Z toward camera
    vec_inv_z = tree.nodes.new('ShaderNodeVectorMath')
    vec_inv_z.operation = 'MULTIPLY'
    vec_inv_z.inputs[1].default_value = (1.0, 1.0, -1.0)
    vec_inv_z.location = (-150, 0)
    tree.links.new(vec_trans.outputs['Vector'], vec_inv_z.inputs[0])

    # Explicitly normalize vector in camera space
    vec_norm = tree.nodes.new('ShaderNodeVectorMath')
    vec_norm.operation = 'NORMALIZE'
    vec_norm.location = (0, 0)
    tree.links.new(vec_inv_z.outputs['Vector'], vec_norm.inputs[0])

    # Multiply by 0.5
    vec_mul = tree.nodes.new('ShaderNodeVectorMath')
    vec_mul.operation = 'MULTIPLY'
    vec_mul.inputs[1].default_value = (0.5, 0.5, 0.5)
    vec_mul.location = (100, 0)
    tree.links.new(vec_norm.outputs['Vector'], vec_mul.inputs[0])

    # Add 0.5
    vec_add = tree.nodes.new('ShaderNodeVectorMath')
    vec_add.operation = 'ADD'
    vec_add.inputs[1].default_value = (0.5, 0.5, 0.5)
    vec_add.location = (250, 0)
    tree.links.new(vec_mul.outputs['Vector'], vec_add.inputs[0])

    emit = tree.nodes.new('ShaderNodeEmission')
    emit.location = (400, 0)
    tree.links.new(vec_add.outputs['Vector'], emit.inputs['Color'])

    out = tree.nodes.new('ShaderNodeOutputMaterial')
    out.location = (600, 0)
    tree.links.new(emit.outputs['Emission'], out.inputs['Surface'])

    return mat

def create_data_pass_material(name='Mat_DataPass', max_height=2.0):
    """
    Renders packed Data pass:
    R: Asset-local normalized height [0..1]
    G: Ambient Occlusion [0..1]
    B: Emissive / Feature mask (0.0)
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.clear()

    geom = tree.nodes.new('ShaderNodeNewGeometry')
    geom.location = (-400, 100)

    sep_pos = tree.nodes.new('ShaderNodeSeparateXYZ')
    sep_pos.location = (-200, 100)
    tree.links.new(geom.outputs['Position'], sep_pos.inputs['Vector'])

    # Map height Z: clamp(Z / max_height, 0, 1)
    height_div = tree.nodes.new('ShaderNodeMath')
    height_div.operation = 'DIVIDE'
    height_div.inputs[1].default_value = max(0.1, max_height)
    height_div.use_clamp = True
    height_div.location = (0, 100)
    tree.links.new(sep_pos.outputs['Z'], height_div.inputs[0])

    # Ambient Occlusion node
    ao_node = tree.nodes.new('ShaderNodeAmbientOcclusion')
    ao_node.inputs['Distance'].default_value = 1.0
    ao_node.location = (0, -100)

    # Combine into RGB: R=Height, G=AO, B=0
    comb_rgb = tree.nodes.new('ShaderNodeCombineColor')
    comb_rgb.mode = 'RGB'
    comb_rgb.inputs['Blue'].default_value = 0.0
    comb_rgb.location = (200, 0)
    tree.links.new(height_div.outputs['Value'], comb_rgb.inputs['Red'])
    tree.links.new(ao_node.outputs['AO'], comb_rgb.inputs['Green'])

    emit = tree.nodes.new('ShaderNodeEmission')
    emit.location = (400, 0)
    tree.links.new(comb_rgb.outputs['Color'], emit.inputs['Color'])

    out = tree.nodes.new('ShaderNodeOutputMaterial')
    out.location = (600, 0)
    tree.links.new(emit.outputs['Emission'], out.inputs['Surface'])

    return mat
