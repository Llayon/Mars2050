#!/usr/bin/env python3
"""
Mars2050 — Voxel Diorama "Парящий остров"
Builds the entire scene programmatically from modular assets.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path.home() / "AppData/Local/opencode/mcp/magicavoxel-mcp"))
from vox_utils import VoxelModel, write_vox_file, render_model_to_image

VOX_DIR = Path("D:/Programms/MagicaVoxel-0.99.7.2-win64/MagicaVoxel-0.99.7.2-win64/vox")
EXPORT_DIR = Path("D:/Programms/MagicaVoxel-0.99.7.2-win64/MagicaVoxel-0.99.7.2-win64/export")
VOX_DIR.mkdir(parents=True, exist_ok=True)
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

# ── Unified Palette ──────────────────────────────────────────────
PALETTE = [
    (0, 0, 0, 0),           # 0 transparent
    (139, 90, 43, 255),     # 1 земля база
    (92, 58, 33, 255),      # 2 земля тёмная
    (160, 114, 69, 255),    # 3 земля светлая
    (76, 175, 80, 255),     # 4 трава база
    (129, 199, 132, 255),   # 5 трава блик
    (56, 142, 60, 255),     # 6 трава тень
    (33, 150, 243, 255),    # 7 вода база
    (100, 181, 246, 255),   # 8 вода светлая
    (255, 255, 255, 255),   # 9 белый (пена/облака)
    (93, 64, 55, 255),      # 10 ствол
    (62, 39, 35, 255),      # 11 ствол тень
    (67, 160, 71, 255),     # 12 листва база
    (102, 187, 106, 255),   # 13 листва блик
    (27, 94, 32, 255),      # 14 листва тень
    (244, 67, 54, 255),     # 15 цветок красный
    (255, 235, 59, 255),    # 16 цветок жёлтый
    (255, 255, 255, 255),   # 17 цветок белый (дубль 9)
    (139, 195, 74, 255),    # 18 стебель
    (215, 204, 200, 255),   # 19 дерево светлое
    (141, 110, 99, 255),    # 20 дерево тень
    (93, 64, 55, 255),      # 21 дерево тёмное
    (158, 158, 158, 255),   # 22 камень база
    (189, 189, 189, 255),   # 23 камень светлый
    (117, 117, 117, 255),   # 24 камень тёмный
    (245, 124, 0, 255),     # 25 сундук основа
    (62, 39, 35, 255),      # 26 сундук окантовка
    (255, 193, 7, 255),     # 27 сундук замок
    (33, 33, 33, 255),      # 28 сундук щель
]
while len(PALETTE) < 256:
    i = len(PALETTE)
    PALETTE.append((i, i, i, 255))

C = lambda i: i  # color shorthand


# ── Asset Builders ───────────────────────────────────────────────

def place_ground_tile(m: VoxelModel, ox: int, oy: int, oz: int,
                      size: int = 10, has_grass: bool = True):
    """Тайл земли с травой (шаги 1.2-1.6)"""
    import random
    # 1.2: base earth
    for x in range(size):
        for y in range(size):
            for z in range(size):
                m.set_voxel(ox + x, oy + y, oz + z, C(1))

    if not has_grass:
        return

    top = oz + size - 1
    # 1.3: grass cap
    for x in range(size):
        for y in range(size):
            m.set_voxel(ox + x, oy + y, top, C(4))

    # 1.4: soil texturing on sides
    for x in [0, size - 1]:
        for y in range(size):
            for z in range(size):
                vx, vy = ox + x, oy + y
                wz = oz + z
                if 4 <= z <= 7 and random.random() < 0.12:
                    m.set_voxel(vx, vy, wz, C(3))
                elif z <= 3 and random.random() < 0.25:
                    m.set_voxel(vx, vy, wz, C(2))
    for y in [0, size - 1]:
        for x in range(size):
            for z in range(size):
                vx, vy = ox + x, oy + y
                wz = oz + z
                if 4 <= z <= 7 and random.random() < 0.12:
                    m.set_voxel(vx, vy, wz, C(3))
                elif z <= 3 and random.random() < 0.25:
                    m.set_voxel(vx, vy, wz, C(2))

    # 1.5: grass fringe (бахрома)
    for x in range(size):
        for y in range(size):
            fringe = 0 if random.random() < 0.6 else (1 if random.random() < 0.7 else 2)
            for f in range(1, fringe + 1):
                for face_x in [0, size - 1]:
                    m.set_voxel(ox + face_x, oy + y, top - f, C(4))
                for face_y in [0, size - 1]:
                    m.set_voxel(ox + x, oy + face_y, top - f, C(4))

    # 1.6: grass details
    for x in range(size):
        for y in range(size):
            vz = top
            r = random.random()
            if r < 0.15:
                m.set_voxel(ox + x, oy + y, vz, C(5))
            elif r < 0.25:
                m.set_voxel(ox + x, oy + y, vz, C(6))


def place_water(m: VoxelModel, ox: int, oy: int, oz: int, size: int = 10):
    """Горизонтальная вода (шаги 2.2-2.3)"""
    import random
    for x in range(size):
        for y in range(size):
            for z in range(size):
                m.set_voxel(ox + x, oy + y, oz + z, C(7))

    top = oz + size - 1
    # ripple lines along X
    for _ in range(5):
        yy = oy + random.randint(1, size - 2)
        for x in range(ox + 1, ox + size - 2):
            if random.random() < 0.6:
                m.set_voxel(x, yy, top, C(8))
    # white highlights
    for _ in range(3):
        x = ox + random.randint(1, size - 2)
        y = oy + random.randint(1, size - 2)
        m.set_voxel(x, y, top, C(9))


def place_waterfall(m: VoxelModel, ox: int, oy: int, oz: int,
                    w: int = 10, d: int = 10, h: int = 20):
    """Вертикальный водопад (шаги 2.4-2.5)"""
    import random
    for x in range(w):
        for y in range(d):
            for z in range(h):
                m.set_voxel(ox + x, oy + y, oz + z, C(7))

    # vertical streams on front face (y=0 or y=d-1)
    face_y = oy  # front
    for _ in range(4):
        x = ox + random.randint(1, w - 2)
        last_z = oz + h - random.randint(0, 3)
        for z in range(oz + 2, last_z):
            if random.random() < 0.7:
                m.set_voxel(x, face_y, z, C(8))
    # foam at bottom
    for x in range(ox, ox + w):
        for y in range(oy, oy + d):
            for z in range(oz, oz + min(5, h)):
                if random.random() < 0.3:
                    m.set_voxel(x, y, z, C(9))


def place_tree(m: VoxelModel, ox: int, oy: int, oz: int,
               trunk_h: int = 10, variant: int = 0):
    """Дерево (шаги 3.2-3.4)"""
    import random
    cx, cy = ox + 1, oy + 1

    # trunk
    for z in range(trunk_h):
        m.set_voxel(cx, cy, oz + z, C(10))
        m.set_voxel(cx + 1, cy, oz + z, C(10))
        m.set_voxel(cx, cy + 1, oz + z, C(10))
        m.set_voxel(cx + 1, cy + 1, oz + z, C(10))
        # bark details
        if z % 3 == 0 and random.random() < 0.4:
            m.set_voxel(cx - 1, cy, oz + z, C(11))
            m.set_voxel(cx + 2, cy + 1, oz + z, C(11))

    # crown layers (cone/pyramid shape)
    layers = [
        (5, trunk_h - 3, 6),     # bottom wide
        (4, trunk_h, 5),         # middle
        (2, trunk_h + 3, 4),     # top
    ]
    if variant == 1:
        layers = [(4, trunk_h - 4, 5), (3, trunk_h - 1, 4), (1, trunk_h + 2, 3)]
    elif variant == 2:
        layers = [(6, trunk_h - 2, 7), (4, trunk_h + 1, 5), (3, trunk_h + 4, 4)]

    for lw, lz, lh in layers:
        hw = lw // 2
        for dx in range(-hw, hw + 1):
            for dy in range(-hw, hw + 1):
                for dz in range(lh):
                    if abs(dx) == hw and abs(dy) == hw and random.random() < 0.3:
                        continue  # round corners
                    m.set_voxel(cx + dx, cy + dy, oz + lz + dz, C(12))
                    r = random.random()
                    if r < 0.12:
                        m.set_voxel(cx + dx, cy + dy, oz + lz + dz, C(13))
                    elif r < 0.20:
                        m.set_voxel(cx + dx, cy + dy, oz + lz + dz, C(14))


def place_bush(m: VoxelModel, ox: int, oy: int, oz: int, size: int = 3):
    """Куст (шаг 3.5)"""
    import random
    for x in range(size):
        for y in range(size):
            for z in range(size):
                dx, dy, dz = x - size // 2, y - size // 2, z - size // 2
                dist = (dx * dx + dy * dy + dz * dz) ** 0.5
                if dist <= size * 0.6 and random.random() < 0.8:
                    c = C(12)
                    r = random.random()
                    if r < 0.15:
                        c = C(13)
                    elif r < 0.25:
                        c = C(14)
                    m.set_voxel(ox + x, oy + y, oz + z, c)


def place_flower(m: VoxelModel, ox: int, oy: int, oz: int,
                 color: int = 15, stem_h: int = 2):
    """Цветок (шаг 3.6)"""
    for z in range(stem_h):
        m.set_voxel(ox, oy, oz + z, C(18))
    # 4-voxel blossom
    m.set_voxel(ox, oy, oz + stem_h, C(color))
    m.set_voxel(ox + 1, oy, oz + stem_h, C(color))
    m.set_voxel(ox, oy + 1, oz + stem_h, C(color))
    m.set_voxel(ox - 1, oy, oz + stem_h, C(color))
    m.set_voxel(ox, oy - 1, oz + stem_h, C(color))


def place_rock(m: VoxelModel, ox: int, oy: int, oz: int,
               w: int = 4, d: int = 4, h: int = 3):
    """Камень (шаги 5.2-5.4)"""
    import random
    for x in range(w):
        for y in range(d):
            for z in range(h):
                # irregular shape: skip some edge voxels
                is_edge = (x == 0 or x == w - 1) and (y == 0 or y == d - 1)
                if is_edge and z == h - 1 and random.random() < 0.5:
                    continue
                c = C(22)
                r = random.random()
                if z == h - 1 and r < 0.3:
                    c = C(23)
                elif z == 0 and r < 0.3:
                    c = C(24)
                m.set_voxel(ox + x, oy + y, oz + z, c)


def place_chest(m: VoxelModel, ox: int, oy: int, oz: int):
    """Сундук (шаги 6.2-6.6)"""
    # body
    for x in range(6):
        for y in range(4):
            for z in range(3):
                m.set_voxel(ox + x, oy + y, oz + z, C(25))

    # lid
    for x in range(6):
        for y in range(4):
            m.set_voxel(ox + x, oy + y, oz + 3, C(25))
    for x in range(6):
        for y in range(1, 3):
            m.set_voxel(ox + x, oy + y, oz + 4, C(25))

    # dark edges (12 ribs)
    for x in [0, 5]:
        for y in range(4):
            for z in range(5):
                m.set_voxel(ox + x, oy + y, oz + z, C(26))
    for y in [0, 3]:
        for x in range(6):
            for z in range(5):
                m.set_voxel(ox + x, oy + y, oz + z, C(26))
    # cross bands on lid
    for x in range(6):
        m.set_voxel(ox + x, oy + 0, oz + 4, C(26))
        m.set_voxel(ox + x, oy + 3, oz + 4, C(26))

    # seam line
    for x in range(6):
        for y in range(4):
            m.set_voxel(ox + x, oy + y, oz + 3, C(28))

    # lock
    m.set_voxel(ox + 3, oy + 2, oz + 3, C(27))
    m.set_voxel(ox + 2, oy + 2, oz + 3, C(27))


def place_cloud(m: VoxelModel, ox: int, oy: int, oz: int,
                w: int = 6, d: int = 4, h: int = 2):
    """Облако (шаги 7.2-7.3)"""
    import random
    for x in range(w):
        for y in range(d):
            m.set_voxel(ox + x, oy + y, oz, C(9))
            r = random.random()
            if r < 0.4:
                m.set_voxel(ox + x, oy + y, oz + 1, C(9))
            if r < 0.15:
                m.set_voxel(ox + x, oy + y, oz + 2, C(9))
    # bumps on top
    for _ in range(4):
        x = ox + random.randint(1, w - 2)
        y = oy + random.randint(1, d - 2)
        for dz in range(1, 4):
            m.set_voxel(x, y, oz + dz, C(9))


def place_stairs(m: VoxelModel, ox: int, oy: int, oz: int, steps: int = 4):
    """Лестница (шаг 4.2)"""
    for i in range(steps):
        sx = ox + i * 2
        sz = oz + i
        for x in range(sx, sx + 3):
            for y in range(oy, oy + 6):
                m.set_voxel(x, y, sz, C(19))
                m.set_voxel(x, y, sz - 1, C(20))


def place_bridge(m: VoxelModel, ox: int, oy: int, oz: int, length: int = 12):
    """Мостик (шаги 4.3-4.4)"""
    for i in range(length):
        if i % 3 != 2:  # gaps every 3
            for x in range(4):
                m.set_voxel(ox + x, oy + i, oz, C(19))
                m.set_voxel(ox + x, oy + i, oz - 1, C(20))

    # support beams underneath
    for i in range(length):
        m.set_voxel(ox, oy + i, oz - 2, C(21))
        m.set_voxel(ox + 3, oy + i, oz - 2, C(21))

    # railings
    for i in range(0, length, 2):
        m.set_voxel(ox, oy + i, oz + 1, C(21))
        m.set_voxel(ox, oy + i, oz + 2, C(21))
        m.set_voxel(ox, oy + i, oz + 3, C(21))
        m.set_voxel(ox + 3, oy + i, oz + 1, C(21))
        m.set_voxel(ox + 3, oy + i, oz + 2, C(21))
        m.set_voxel(ox + 3, oy + i, oz + 3, C(21))
    # top rail
    for i in range(length):
        m.set_voxel(ox, oy + i, oz + 3, C(21))
        m.set_voxel(ox + 3, oy + i, oz + 3, C(21))


# ── Diorama Builder ──────────────────────────────────────────────

def build_diorama() -> VoxelModel:
    import random
    SCENE_W, SCENE_D, SCENE_H = 80, 80, 50
    m = VoxelModel(SCENE_W, SCENE_D, SCENE_H)
    m.palette = PALETTE[:]

    # === MAIN ISLAND ===
    # We build on ground level z=2 (leaving z=0-1 for stalactites)

    # Lower platform (roughly 18x18 tiles area)
    island_ox, island_oy = 15, 15
    platform_tiles = set()
    for tx in range(18):
        for ty in range(18):
            cx, cy = island_ox + tx * 10, island_oy + ty * 10
            # rounded shape — omit corners
            dx, dy = tx - 9, ty - 9
            dist = (dx * dx + dy * dy) ** 0.5
            if dist > 10:
                continue
            if 9.5 < dist <= 10 and random.random() < 0.4:
                continue
            platform_tiles.add((tx, ty))

    for tx, ty in platform_tiles:
        cx, cy = island_ox + tx * 10, island_oy + ty * 10
        place_ground_tile(m, cx, cy, 2)

    # Middle terrace (6x6 area, shifted)
    mid_ox, mid_oy = island_ox + 4 * 10, island_oy + 4 * 10
    for tx in range(6):
        for ty in range(6):
            cx, cy = mid_ox + tx * 10, mid_oy + ty * 10
            dx, dy = tx - 3, ty - 3
            if (dx * dx + dy * dy) ** 0.5 > 4:
                continue
            place_ground_tile(m, cx, cy, 12)

    # Mountain top (3x3)
    top_ox, top_oy = mid_ox + 1 * 10, mid_oy + 1 * 10
    for tx in range(3):
        for ty in range(3):
            cx, cy = top_ox + tx * 10, top_oy + ty * 10
            place_ground_tile(m, cx, cy, 22)

    # === STALACTITES (hanging rocks below island) ===
    for _ in range(15):
        tx = random.randint(0, 17)
        ty = random.randint(0, 17)
        if (tx, ty) not in platform_tiles:
            continue
        bx, by = island_ox + tx * 10 + 5, island_oy + ty * 10 + 5
        length = random.randint(3, 8)
        r = random.random()
        if r < 0.3:
            length = random.randint(1, 3)
        for i in range(length):
            rad = max(1, 3 - i // 2)
            for dx in range(-rad, rad + 1):
                for dy in range(-rad, rad + 1):
                    if abs(dx) == rad and abs(dy) == rad and random.random() < 0.3:
                        continue
                    m.set_voxel(bx + dx, by + dy, 1 - i, C(3) if random.random() < 0.2 else C(1))

    # === WATERFALLS ===
    # Source on mountain top
    source_x, source_y = top_ox + 5, top_oy + 5
    for x in range(10):
        for y in range(10):
            for z in range(3):
                m.set_voxel(source_x + x, source_y + y, 22 + z, C(7))

    # Cascade 1: mountain → middle terrace
    cascade1_x = source_x + 4
    cascade1_y = source_y + 10
    place_waterfall(m, cascade1_x, cascade1_y, 14, w=3, d=3, h=8)

    # Pool on middle terrace
    for x in range(12):
        for y in range(12):
            for z in range(3):
                m.set_voxel(cascade1_x + x - 4, cascade1_y + y - 4, 12 + z, C(7))

    # Cascade 2: middle → lower
    cascade2_x = cascade1_x + 2
    cascade2_y = cascade1_y + 8
    place_waterfall(m, cascade2_x, cascade2_y, 4, w=3, d=3, h=10)

    # Pool on lower level
    for x in range(14):
        for y in range(14):
            for z in range(3):
                m.set_voxel(cascade2_x + x - 5, cascade2_y + y - 5, 2 + z, C(7))

    # Main waterfall off the edge
    main_x = island_ox + 16 * 10
    main_y = island_oy + 5 * 10
    place_waterfall(m, main_x + 2, main_y, 0, w=6, d=3, h=24)

    # === BRIDGES & STAIRS ===
    # Stairs: lower → middle
    place_stairs(m, mid_ox - 4, mid_oy + 5, 10, steps=4)
    place_stairs(m, mid_ox + 7 * 10 - 4, mid_oy + 3, 10, steps=4)

    # Bridge over middle pool
    place_bridge(m, cascade1_x + 2, cascade1_y + 9, 14, length=8)
    place_bridge(m, cascade1_x + 6, cascade1_y - 2, 14, length=8)

    # === TREES ===
    tree_positions = [
        (island_ox + 2 * 10 + 2, island_oy + 3 * 10 + 2, 2, 0),
        (island_ox + 12 * 10 + 3, island_oy + 2 * 10 + 3, 2, 1),
        (island_ox + 8 * 10 + 4, island_oy + 14 * 10 + 2, 2, 2),
        (mid_ox + 3 * 10 + 2, mid_oy + 2 * 10 + 2, 12, 0),
        (top_ox + 4, top_oy + 2, 22, 1),
        (island_ox + 15 * 10 + 2, island_oy + 10 * 10 + 3, 2, 2),
    ]
    for tx, ty, tz, var in tree_positions:
        if (tx // 10 - 15 if 10 <= tx - island_ox < 180 else -1,
            ty // 10 - 15 if 10 <= ty - island_oy < 180 else -1) in platform_tiles or \
           (0 <= tx - mid_ox < 60 and 0 <= ty - mid_oy < 60) or \
           (0 <= tx - top_ox < 30 and 0 <= ty - top_oy < 30):
            place_tree(m, tx, ty, tz, variant=var)

    # === ROCKS ===
    rock_positions = [
        (island_ox + 2 * 10, island_oy + 5 * 10, 2, 4, 4, 2),
        (island_ox + 14 * 10, island_oy + 12 * 10, 2, 5, 3, 3),
        (mid_ox + 10, mid_oy + 30, 12, 3, 3, 2),
        (cascade1_x + 8, cascade1_y + 9, 12, 4, 4, 2),
        (cascade2_x - 2, cascade2_y + 6, 4, 3, 3, 2),
        (cascade2_x + 10, cascade2_y - 2, 4, 4, 3, 2),
        (top_ox + 20, top_oy + 15, 22, 3, 3, 2),
    ]
    for rx, ry, rz, rw, rd, rh in rock_positions:
        place_rock(m, rx, ry, rz, rw, rd, rh)

    # === BUSHES ===
    for _ in range(12):
        attempt = 0
        while attempt < 20:
            bx = random.randint(island_ox + 5, island_ox + 17 * 10)
            by = random.randint(island_oy + 5, island_oy + 17 * 10)
            bz = 2
            if bx < mid_ox + 60 and by < mid_oy + 60 and bx > mid_ox - 10 and by > mid_oy - 10:
                bz = 12
            if bx < top_ox + 30 and by < top_oy + 30 and bx > top_ox - 10 and by > top_oy - 10:
                bz = 22
            place_bush(m, bx, by, bz, size=random.choice([2, 3]))
            break
        attempt += 1

    # === FLOWERS ===
    flower_colors = [15, 16, 17]
    for _ in range(8):
        fx = random.randint(island_ox + 10, island_ox + 16 * 10)
        fy = random.randint(island_oy + 10, island_oy + 16 * 10)
        fc = random.choice(flower_colors)
        place_flower(m, fx, fy, 2, color=fc)

    # === CHEST on mountain top ===
    place_chest(m, top_ox + 12, top_oy + 12, 22)

    # === SATELLITE ISLANDS ===
    sat_positions = [
        (island_ox + 19 * 10 + 5, island_oy + 3 * 10, 8, 0),
        (island_ox - 3 * 10, island_oy + 12 * 10, 5, 1),
    ]
    for sx, sy, sz, variant in sat_positions:
        for x in range(6):
            for y in range(6):
                for z in range(3):
                    m.set_voxel(sx + x, sy + y, sz + z, C(1))
                m.set_voxel(sx + x, sy + y, sz + 3, C(4))
        # small tree or rock
        if variant == 0:
            place_tree(m, sx + 1, sy + 1, sz + 3, trunk_h=5, variant=0)
        else:
            place_rock(m, sx + 1, sy + 1, sz + 3, 3, 3, 2)

    # === CLOUDS ===
    cloud_positions = [
        (10, 10, 35, 8, 4, 3),
        (30, 55, 30, 6, 3, 2),
        (60, 20, 38, 7, 4, 3),
        (5, 65, 28, 5, 3, 2),
        (55, 60, 40, 9, 5, 3),
        (25, 70, 25, 6, 3, 2),
        (65, 5, 32, 5, 3, 2),
    ]
    for cx, cy, cz, cw, cd, ch in cloud_positions:
        place_cloud(m, cx, cy, cz, cw, cd, ch)

    print(f"Scene built: {m.get_voxel_count()} voxels, bounds={m.get_bounds()}")
    return m


def main():
    name = "floating_island"
    model = build_diorama()

    vox_path = VOX_DIR / f"{name}.vox"
    write_vox_file(vox_path, model)
    print(f"Saved: {vox_path}")

    # Export renders
    from PIL import Image
    angles = ["front", "top"]
    for angle in angles:
        raw = EXPORT_DIR / f"{name}_{angle}_raw.png"
        out = EXPORT_DIR / f"{name}_{angle}.png"
        ok = render_model_to_image(model, angle, raw)
        if ok:
            img = Image.open(raw).convert("RGBA")
            scale = 4
            scaled = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
            scaled.save(out, "PNG")
            raw.unlink()
            print(f"Rendered: {out}")
        else:
            print(f"Render {angle} failed", file=sys.stderr)


if __name__ == "__main__":
    main()
