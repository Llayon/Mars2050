#!/usr/bin/env python3
"""
Mars2050 — Martian Habitat Dome (MCP)
Generates a 3D model of a Martian Habitat Dome using vox_utils.
"""

import sys
import math
from pathlib import Path

# Path to magicavoxel-mcp utilities
mcp_path = Path.home() / "AppData/Local/opencode/mcp/magicavoxel-mcp"
sys.path.insert(0, str(mcp_path))

try:
    from vox_utils import VoxelModel, write_vox_file, render_model_to_image
except ImportError:
    print(f"Error: Could not import vox_utils from {mcp_path}")
    sys.exit(1)

# Paths
VOX_DIR = Path("D:/Programms/MagicaVoxel-0.99.7.2-win64/MagicaVoxel-0.99.7.2-win64/vox")
EXPORT_DIR = Path("D:/Programms/MagicaVoxel-0.99.7.2-win64/MagicaVoxel-0.99.7.2-win64/export")
VOX_DIR.mkdir(parents=True, exist_ok=True)
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

# ── Palette ──────────────────────────────────────────────────────
# 1: Orange-red for the base (Mars surface)
# 2: Grey for the structural frame
# 3: Light blue/translucent for the glass panels
PALETTE = [
    (0, 0, 0, 0),           # 0 transparent
    (226, 123, 88, 255),    # 1 Mars Surface (Orange-Red)
    (150, 150, 150, 255),   # 2 Structural Frame (Grey)
    (173, 216, 230, 150),   # 3 Glass Panels (Light Blue, semi-transparent)
]
while len(PALETTE) < 256:
    PALETTE.append((0, 0, 0, 255))

def create_habitat_dome_mcp():
    SIZE = 40
    HEIGHT = 25
    RADIUS = 18
    CENTER_X = SIZE // 2
    CENTER_Y = SIZE // 2
    
    m = VoxelModel(SIZE, SIZE, HEIGHT)
    m.palette = PALETTE[:]

    # 1. Base (Mars Surface)
    for x in range(SIZE):
        for y in range(SIZE):
            m.set_voxel(x, y, 0, 1)

    # 2. Dome Shell (Hemisphere)
    for x in range(SIZE):
        for y in range(SIZE):
            for z in range(1, HEIGHT):
                dx = x - CENTER_X
                dy = y - CENTER_Y
                dz = z - 1 # Surface is at z=0, dome starts at z=1
                
                dist = math.sqrt(dx*dx + dy*dy + dz*dz)
                
                # Create a thin shell
                if RADIUS - 0.5 <= dist <= RADIUS + 0.5:
                    # Determine if it's a structural frame or glass
                    angle = math.atan2(dy, dx)
                    is_frame = False
                    
                    # Vertical ribs every 30 degrees
                    if abs(math.sin(angle * 6)) > 0.95:
                        is_frame = True
                    
                    # Horizontal rings
                    if z % 5 == 0:
                        is_frame = True
                    
                    if is_frame:
                        m.set_voxel(x, y, z, 2) # Frame
                    else:
                        m.set_voxel(x, y, z, 3) # Glass

    return m

def main():
    name = "habitat_dome_mcp"
    model = create_habitat_dome_mcp()

    vox_path = VOX_DIR / f"{name}.vox"
    write_vox_file(vox_path, model)
    print(f"Saved: {vox_path}")

    # Render
    raw_path = EXPORT_DIR / f"{name}_render.png"
    ok = render_model_to_image(model, "front", raw_path)
    if ok:
        print(f"Rendered: {raw_path}")
    else:
        print("Render failed (this is expected if renderer is not configured)")

if __name__ == "__main__":
    main()
