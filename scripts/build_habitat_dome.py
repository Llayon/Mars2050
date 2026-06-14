#!/usr/bin/env python3
"""
Mars2050 — Habitat Dome Generator
Builds a modular living dome for the Martian colony.
"""

import sys
import math
from pathlib import Path

# Try to find the magicavoxel-mcp utilities
mcp_path = Path.home() / "AppData/Local/opencode/mcp/magicavoxel-mcp"
sys.path.insert(0, str(mcp_path))

try:
    from vox_utils import VoxelModel, write_vox_file, render_model_to_image
except ImportError:
    print(f"Error: Could not import vox_utils from {mcp_path}")
    print("Ensure the magicavoxel-mcp is installed at the correct location.")
    sys.exit(1)

VOX_DIR = Path("D:/Programms/MagicaVoxel-0.99.7.2-win64/MagicaVoxel-0.99.7.2-win64/vox")
EXPORT_DIR = Path("D:/Programms/MagicaVoxel-0.99.7.2-win64/MagicaVoxel-0.99.7.2-win64/export")
VOX_DIR.mkdir(parents=True, exist_ok=True)
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

# ── Palette ──────────────────────────────────────────────────────
PALETTE = [
    (0, 0, 0, 0),           # 0 transparent
    (226, 123, 88, 255),    # 1 Mars Surface (Orange-Red)
    (112, 112, 112, 255),   # 2 Metal Structure (Grey)
    (160, 208, 255, 180),   # 3 Glass (Translucent Blue)
    (64, 64, 64, 255),      # 4 Floor (Dark Grey)
    (76, 175, 80, 255),     # 5 Plants (Green)
    (255, 255, 255, 255),   # 6 Interior Lights (White)
]
while len(PALETTE) < 256:
    i = len(PALETTE)
    PALETTE.append((i, i, i, 255))

def build_habitat_dome() -> VoxelModel:
    SIZE = 40
    HEIGHT = 20
    m = VoxelModel(SIZE, SIZE, HEIGHT)
    m.palette = PALETTE[:]

    CENTER_X = SIZE // 2
    CENTER_Y = SIZE // 2
    RADIUS = 18

    # 1. Foundation / Floor
    for x in range(SIZE):
        for y in range(SIZE):
            dx = x - CENTER_X
            dy = y - CENTER_Y
            dist = math.sqrt(dx*dx + dy*dy)
            
            if dist <= RADIUS:
                m.set_voxel(x, y, 0, 4) # Floor
            elif dist <= RADIUS + 1:
                m.set_voxel(x, y, 0, 2) # Metal Ring

    # 2. Interior Details (Living Modules)
    # Simple blocks inside to represent rooms
    for x in range(CENTER_X - 5, CENTER_X + 5):
        for y in range(CENTER_Y - 5, CENTER_Y + 5):
            for z in range(1, 4):
                m.set_voxel(x, y, z, 2)
    
    # Air lock / Entry
    for y in range(CENTER_Y - 2, CENTER_Y + 2):
        for x in range(CENTER_X + RADIUS - 2, CENTER_X + RADIUS + 2):
            for z in range(1, 5):
                m.set_voxel(x, y, z, 2)

    # 3. The Dome (Hemisphere)
    for x in range(SIZE):
        for y in range(SIZE):
            for z in range(HEIGHT):
                dx = x - CENTER_X
                dy = y - CENTER_Y
                dz = z # Z=0 is floor
                
                # Equation of hemisphere: x^2 + y^2 + z^2 = R^2
                # We want a shell, so we check distance from center
                dist = math.sqrt(dx*dx + dy*dy + dz*dz)
                
                if RADIUS - 0.5 <= dist <= RADIUS + 0.5:
                    # Structural Ribs (every 45 degrees and at height intervals)
                    angle = math.atan2(dy, dx)
                    is_rib = False
                    
                    # Vertical ribs
                    if abs(math.sin(angle * 4)) > 0.95:
                        is_rib = True
                    
                    # Horizontal ribs
                    if z % 6 == 0:
                        is_rib = True
                        
                    if is_rib:
                        m.set_voxel(x, y, z, 2) # Metal
                    else:
                        m.set_voxel(x, y, z, 3) # Glass

    print(f"Dome built: {m.get_voxel_count()} voxels")
    return m

def main():
    name = "habitat_dome"
    model = build_habitat_dome()

    vox_path = VOX_DIR / f"{name}.vox"
    write_vox_file(vox_path, model)
    print(f"Saved: {vox_path}")

    # Render
    raw = EXPORT_DIR / f"{name}_iso_raw.png"
    out = EXPORT_DIR / f"{name}_iso.png"
    ok = render_model_to_image(model, "front", raw)
    if ok:
        print(f"Rendered raw image to {raw}")
        # Note: PIL might not be available or need installation
        # But the vox file is the main asset.
    else:
        print("Render failed")

if __name__ == "__main__":
    main()
