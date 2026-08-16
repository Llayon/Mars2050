"""
Procedural material library for Mars2050 terrain rendering in Blender.
Provides specialized Martian shaders: Regolith, Basalt, Dust, and Rock.
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
